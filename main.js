const path = require('path');
const url = require('url');
const os = require('os');

const _ = require('lodash');
const electron = require('electron');
const semver = require('semver');

const {
  BrowserWindow,
  app,
  Menu,
  shell,
  ipcMain: ipc,
} = electron;

const packageJson = require('./package.json');

const autoUpdate = require('./app/auto_update');
const createTrayIcon = require('./app/tray_icon');
const logging = require('./app/logging');
const windowState = require('./app/window_state');
const { createTemplate } = require('./app/menu');

const appUserModelId = `org.whispersystems.${packageJson.name}`;
console.log('Set Windows Application User Model ID (AUMID)', { appUserModelId });
app.setAppUserModelId(appUserModelId);

// Keep a global reference of the window object, if you don't, the window will
//   be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function getMainWindow() {
  return mainWindow;
}

// Tray icon and related objects
let tray = null;
const startInTray = process.argv.some(arg => arg === '--start-in-tray');
const usingTrayIcon = startInTray || process.argv.some(arg => arg === '--use-tray-icon');


const config = require('./app/config');

const importMode = process.argv.some(arg => arg === '--import') || config.get('import');


const development = config.environment === 'development';

// Very important to put before the single instance check, since it is based on the
//   userData directory.
const userConfig = require('./app/user_config');

function showWindow() {
  if (!mainWindow) {
    return;
  }

  // Using focus() instead of show() seems to be important on Windows when our window
  //   has been docked using Aero Snap/Snap Assist. A full .show() call here will cause
  //   the window to reposition:
  //   https://github.com/signalapp/Signal-Desktop/issues/1429
  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
  }

  // toggle the visibility of the show/hide tray icon menu entries
  if (tray) {
    tray.updateContextMenu();
  }
}

if (!process.mas) {
  console.log('making app single instance');
  const shouldQuit = app.makeSingleInstance(() => {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      showWindow();
    }
    return true;
  });

  if (shouldQuit) {
    console.log('quitting; we are the second instance');
    app.exit();
  }
}

let windowConfig = userConfig.get('window');
const loadLocale = require('./app/locale').load;

// Both of these will be set after app fires the 'ready' event
let logger;
let locale;

const WINDOWS_8 = '8.0.0';
const osRelease = os.release();
const polyfillNotifications =
  os.platform() === 'win32' && semver.lt(osRelease, WINDOWS_8);
console.log('OS Release:', osRelease, '- notifications polyfill?', polyfillNotifications);

function prepareURL(pathSegments) {
  return url.format({
    pathname: path.join.apply(null, pathSegments),
    protocol: 'file:',
    slashes: true,
    query: {
      name: packageJson.productName,
      locale: locale.name,
      version: app.getVersion(),
      buildExpiration: config.get('buildExpiration'),
      serverUrl: config.get('serverUrl'),
      cdnUrl: config.get('cdnUrl'),
      certificateAuthorities: config.get('certificateAuthorities'),
      environment: config.environment,
      node_version: process.versions.node,
      hostname: os.hostname(),
      appInstance: process.env.NODE_APP_INSTANCE,
      polyfillNotifications: polyfillNotifications ? true : undefined, // for stringify()
      proxyUrl: process.env.HTTPS_PROXY || process.env.https_proxy,
      importMode: importMode ? true : undefined, // for stringify()
    },
  });
}

function handleUrl(event, target) {
  event.preventDefault();
  const { protocol } = url.parse(target);
  if (protocol === 'http:' || protocol === 'https:') {
    shell.openExternal(target);
  }
}

function captureClicks(window) {
  window.webContents.on('will-navigate', handleUrl);
  window.webContents.on('new-window', handleUrl);
}


const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 610;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 360;
const BOUNDS_BUFFER = 100;

function isVisible(window, bounds) {
  const boundsX = _.get(bounds, 'x') || 0;
  const boundsY = _.get(bounds, 'y') || 0;
  const boundsWidth = _.get(bounds, 'width') || DEFAULT_WIDTH;
  const boundsHeight = _.get(bounds, 'height') || DEFAULT_HEIGHT;

  // requiring BOUNDS_BUFFER pixels on the left or right side
  const rightSideClearOfLeftBound = (window.x + window.width >= boundsX + BOUNDS_BUFFER);
  const leftSideClearOfRightBound = (window.x <= (boundsX + boundsWidth) - BOUNDS_BUFFER);

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound = (window.y <= (boundsY + boundsHeight) - BOUNDS_BUFFER);

  return rightSideClearOfLeftBound &&
    leftSideClearOfRightBound &&
    topClearOfUpperBound &&
    topClearOfLowerBound;
}

function createWindow() {
  const { screen } = electron;
  const windowOptions = Object.assign({
    show: !startInTray, // allow to start minimised in tray
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      // sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'images', 'icon_256.png'),
  }, _.pick(windowConfig, ['maximized', 'autoHideMenuBar', 'width', 'height', 'x', 'y']));

  if (!_.isNumber(windowOptions.width) || windowOptions.width < MIN_WIDTH) {
    windowOptions.width = DEFAULT_WIDTH;
  }
  if (!_.isNumber(windowOptions.height) || windowOptions.height < MIN_HEIGHT) {
    windowOptions.height = DEFAULT_HEIGHT;
  }
  if (!_.isBoolean(windowOptions.maximized)) {
    delete windowOptions.maximized;
  }
  if (!_.isBoolean(windowOptions.autoHideMenuBar)) {
    delete windowOptions.autoHideMenuBar;
  }

  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), (display) => {
    if (!_.isNumber(windowOptions.x) || !_.isNumber(windowOptions.y)) {
      return false;
    }

    return isVisible(windowOptions, _.get(display, 'bounds'));
  });
  if (!visibleOnAnyScreen) {
    console.log('Location reset needed');
    delete windowOptions.x;
    delete windowOptions.y;
  }

  if (windowOptions.fullscreen === false) {
    delete windowOptions.fullscreen;
  }

  logger.info('Initializing BrowserWindow config: %s', JSON.stringify(windowOptions));

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);

  function captureAndSaveWindowStats() {
    if (!mainWindow) {
      return;
    }

    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      autoHideMenuBar: mainWindow.isMenuBarAutoHide(),
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1],
    };

    if (mainWindow.isFullScreen()) {
      // Only include this property if true, because when explicitly set to
      // false the fullscreen button will be disabled on osx
      windowConfig.fullscreen = true;
    }

    logger.info('Updating BrowserWindow config: %s', JSON.stringify(windowConfig));
    userConfig.set('window', windowConfig);
  }

  const debouncedCaptureStats = _.debounce(captureAndSaveWindowStats, 500);
  mainWindow.on('resize', debouncedCaptureStats);
  mainWindow.on('move', debouncedCaptureStats);
  mainWindow.on('close', captureAndSaveWindowStats);

  mainWindow.on('focus', () => {
    mainWindow.flashFrame(false);
  });

  // Ingested in preload.js via a sendSync call
  ipc.on('locale-data', (event) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = locale.messages;
  });

  if (config.environment === 'test') {
    mainWindow.loadURL(prepareURL([__dirname, 'test', 'index.html']));
  } else if (config.environment === 'test-lib') {
    mainWindow.loadURL(prepareURL([__dirname, 'libtextsecure', 'test', 'index.html']));
  } else {
    mainWindow.loadURL(prepareURL([__dirname, 'background.html']));
  }

  if (config.get('openDevTools')) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  }

  captureClicks(mainWindow);

  mainWindow.webContents.on('will-navigate', (e) => {
    logger.info('will-navigate');
    e.preventDefault();
  });

  // Emitted when the window is about to be closed.
  mainWindow.on('close', (e) => {
    // If the application is terminating, just do the default
    if (windowState.shouldQuit() ||
        config.environment === 'test' || config.environment === 'test-lib') {
      return;
    }

    // On Mac, or on other platforms when the tray icon is in use, the window
    // should be only hidden, not closed, when the user clicks the close button
    if (usingTrayIcon || process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();

      // toggle the visibility of the show/hide tray icon menu entries
      if (tray) {
        tray.updateContextMenu();
      }
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  ipc.on('show-window', () => {
    showWindow();
  });
}

function showDebugLog() {
  if (mainWindow) {
    mainWindow.webContents.send('debug-log');
  }
}

function openReleaseNotes() {
  shell.openExternal(`https://github.com/signalapp/Signal-Desktop/releases/tag/v${app.getVersion()}`);
}

function openNewBugForm() {
  shell.openExternal('https://github.com/signalapp/Signal-Desktop/issues/new');
}

function openSupportPage() {
  shell.openExternal('https://support.signal.org/hc/en-us/categories/202319038-Desktop');
}

function openForums() {
  shell.openExternal('https://community.signalusers.org/');
}

function setupWithImport() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-with-import');
  }
}

function setupAsNewDevice() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-new-device');
  }
}

function setupAsStandalone() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-standalone');
  }
}


let aboutWindow;
function showAbout() {
  if (aboutWindow) {
    aboutWindow.show();
    return;
  }

  const options = {
    width: 500,
    height: 400,
    resizable: false,
    title: locale.messages.aboutSignalDesktop.message,
    autoHideMenuBar: true,
    backgroundColor: '#2090EA',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    parent: mainWindow,
  };

  aboutWindow = new BrowserWindow(options);

  captureClicks(aboutWindow);

  aboutWindow.loadURL(prepareURL([__dirname, 'about.html']));

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let ready = false;
app.on('ready', () => {
  // NOTE: Temporarily allow `then` until we convert the entire file to `async` / `await`:
  /* eslint-disable more/no-then */
  let loggingSetupError;
  logging.initialize().catch((error) => {
    loggingSetupError = error;
  }).then(() => {
    logger = logging.getLogger();
    logger.info('app ready');

    if (loggingSetupError) {
      logger.error('Problem setting up logging', loggingSetupError.stack);
    }

    if (!locale) {
      const appLocale = process.env.NODE_ENV === 'test' ? 'en' : app.getLocale();
      locale = loadLocale({ appLocale, logger });
    }

    ready = true;

    autoUpdate.initialize(getMainWindow, locale.messages);

    createWindow();

    if (usingTrayIcon) {
      tray = createTrayIcon(getMainWindow, locale.messages);
    }

    setupMenu();
  });
  /* eslint-enable more/no-then */
});

function setupMenu(options) {
  const menuOptions = Object.assign({}, options, {
    development,
    showDebugLog,
    showWindow,
    showAbout,
    openReleaseNotes,
    openNewBugForm,
    openSupportPage,
    openForums,
    setupWithImport,
    setupAsNewDevice,
    setupAsStandalone,
  });
  const template = createTemplate(menuOptions, locale.messages);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


app.on('before-quit', () => {
  windowState.markShouldQuit();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin' ||
      config.environment === 'test' ||
      config.environment === 'test-lib') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!ready) {
    return;
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

ipc.on('set-badge-count', (event, count) => {
  app.setBadgeCount(count);
});

ipc.on('remove-setup-menu-items', () => {
  setupMenu();
});

ipc.on('add-setup-menu-items', () => {
  setupMenu({
    includeSetup: true,
  });
});


ipc.on('draw-attention', () => {
  if (process.platform === 'darwin') {
    app.dock.bounce();
  } else if (process.platform === 'win32') {
    mainWindow.flashFrame(true);
    setTimeout(() => {
      mainWindow.flashFrame(false);
    }, 1000);
  } else if (process.platform === 'linux') {
    mainWindow.flashFrame(true);
  }
});

ipc.on('restart', () => {
  app.relaunch();
  app.quit();
});

ipc.on('set-auto-hide-menu-bar', (event, autoHide) => {
  if (mainWindow) {
    mainWindow.setAutoHideMenuBar(autoHide);
  }
});

ipc.on('set-menu-bar-visibility', (event, visibility) => {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(visibility);
  }
});

ipc.on('close-about', () => {
  if (aboutWindow) {
    aboutWindow.close();
  }
});

ipc.on('update-tray-icon', (event, unreadCount) => {
  if (tray) {
    tray.updateIcon(unreadCount);
  }
});
