const path = require('path');
const url = require('url');
const os = require('os');

const _ = require('lodash');
const electron = require('electron');
const semver = require('semver');

const BrowserWindow = electron.BrowserWindow;
const app = electron.app;
const ipc = electron.ipcMain;
const Menu = electron.Menu;
const shell = electron.shell;

const packageJson = require('./package.json');
const autoUpdate = require('./app/auto_update');
const windowState = require('./app/window_state');


const aumid = 'org.whispersystems.' + packageJson.name;
console.log('setting AUMID to ' + aumid);
app.setAppUserModelId(aumid);

// Keep a global reference of the window object, if you don't, the window will
//   be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function getMainWindow() {
  return mainWindow;
}

// Tray icon and related objects
let tray = null;
const startInTray = process.argv.find(arg => arg === '--start-in-tray');
const usingTrayIcon = startInTray || process.argv.find(arg => arg === '--use-tray-icon');

const config = require("./app/config");

// Very important to put before the single instance check, since it is based on the
//   userData directory.
const userConfig = require('./app/user_config');

if (!process.mas) {
  console.log('making app single instance');
  var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    return true;
  });

  if (shouldQuit) {
    console.log('quitting; we are the second instance');
    app.quit();
    return;
  }
}

const logging = require('./app/logging');

// This must be after we set up appPath in user_config.js, so we know where logs go
logging.initialize();
const logger = logging.getLogger();

let windowConfig = userConfig.get('window');
const loadLocale = require('./app/locale').load;

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
    }
  })
}

function handleUrl(event, target) {
  event.preventDefault();
  const protocol = url.parse(target).protocol;
  if (protocol === 'http:' || protocol === 'https:') {
    shell.openExternal(target);
  }
}

function captureClicks(window) {
  window.webContents.on('will-navigate', handleUrl)
  window.webContents.on('new-window', handleUrl);
}


const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 610;
const MIN_WIDTH = 700;
const MIN_HEIGHT = 360;
const BOUNDS_BUFFER = 100;

function isVisible(window, bounds) {
  const boundsX = _.get(bounds, 'x') || 0;
  const boundsY = _.get(bounds, 'y') || 0;
  const boundsWidth = _.get(bounds, 'width') || DEFAULT_WIDTH;
  const boundsHeight = _.get(bounds, 'height') || DEFAULT_HEIGHT;

  // requiring BOUNDS_BUFFER pixels on the left or right side
  const rightSideClearOfLeftBound = (window.x + window.width >= boundsX + BOUNDS_BUFFER);
  const leftSideClearOfRightBound = (window.x <= boundsX + boundsWidth - BOUNDS_BUFFER);

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound = (window.y <= boundsY + boundsHeight - BOUNDS_BUFFER);

  return rightSideClearOfLeftBound
    && leftSideClearOfRightBound
    && topClearOfUpperBound
    && topClearOfLowerBound;
}

function createWindow () {
  const screen = electron.screen;
  const windowOptions = Object.assign({
    show: !startInTray, // allow to start minimised in tray
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      //sandbox: true,
      preload: path.join(__dirname, 'preload.js')
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

  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), function(display) {
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
    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      autoHideMenuBar: mainWindow.isMenuBarAutoHide(),
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1]
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

  mainWindow.on('focus', function() {
    mainWindow.flashFrame(false);
  });

  // Ingested in preload.js via a sendSync call
  ipc.on('locale-data', function(event, arg) {
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
    mainWindow.webContents.openDevTools()
  }

  captureClicks(mainWindow);

  mainWindow.webContents.on('will-navigate', function(e) {
    logger.info('will-navigate');
    e.preventDefault();
  });

  // Emitted when the window is about to be closed.
  mainWindow.on('close', function (e) {

    // If the application is terminating, just do the default
    if (windowState.shouldQuit()
      || config.environment === 'test' || config.environment === 'test-lib') {

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
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  });

  ipc.on('show-window', function() {
    // Using focus() instead of show() seems to be important on Windows when our window
    //   has been docked using Aero Snap/Snap Assist. A full .show() call here will cause
    //   the window to reposition:
    //   https://github.com/WhisperSystems/Signal-Desktop/issues/1429
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }

    // toggle the visibility of the show/hide tray icon menu entries
    if (tray) {
      tray.updateContextMenu();
    }
  });
}

function showDebugLog() {
  if (mainWindow) {
    mainWindow.webContents.send('debug-log')
  }
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
  }
};

function openReleaseNotes() {
  shell.openExternal('https://github.com/WhisperSystems/Signal-Desktop/releases/tag/v' + app.getVersion());
}

function openNewBugForm() {
  shell.openExternal('https://github.com/WhisperSystems/Signal-Desktop/issues/new');
}

function openSupportPage() {
  shell.openExternal('https://support.signal.org/hc/en-us/categories/202319038-Desktop');
}

function openForums() {
  shell.openExternal('https://whispersystems.discoursehosting.net/');
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
      preload: path.join(__dirname, 'preload.js')
    },
    parent: mainWindow,
  };

  aboutWindow = new BrowserWindow(options);

  captureClicks(aboutWindow);

  aboutWindow.loadURL(prepareURL([__dirname, 'about.html']));

  aboutWindow.on('closed', function () {
    aboutWindow = null;
  });

  aboutWindow.once('ready-to-show', function() {
    aboutWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let ready = false;
app.on('ready', function() {
  logger.info('app ready');
  ready = true;

  if (!locale) {
    locale = loadLocale();
  }

  autoUpdate.initialize(getMainWindow, locale.messages);

  createWindow();

  if (usingTrayIcon) {
    const createTrayIcon = require("./app/tray_icon");
    tray = createTrayIcon(getMainWindow, locale.messages);
  }

  const options = {
    showDebugLog,
    showWindow,
    showAbout,
    openReleaseNotes,
    openNewBugForm,
    openSupportPage,
    openForums,
  };
  const createTemplate = require('./app/menu.js');
  const template = createTemplate(options, locale.messages);

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
})

app.on('before-quit', function() {
  windowState.markShouldQuit();
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin' || config.environment === 'test' || config.environment === 'test-lib') {
    app.quit()
  }
})

app.on('activate', function () {
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
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipc.on('set-badge-count', function(event, count) {
  app.setBadgeCount(count);
});

ipc.on('draw-attention', function(event, count) {
  if (process.platform === 'darwin') {
    app.dock.bounce();
  } else if (process.platform == 'win32') {
    mainWindow.flashFrame(true);
    setTimeout(function() {
      mainWindow.flashFrame(false);
    }, 1000);
  } else if (process.platform == 'linux') {
    mainWindow.flashFrame(true);
  }
});

ipc.on('restart', function(event) {
  app.relaunch();
  app.quit();
});

ipc.on("set-auto-hide-menu-bar", function(event, autoHide) {
  if (mainWindow) {
    mainWindow.setAutoHideMenuBar(autoHide);
  }
});

ipc.on("set-menu-bar-visibility", function(event, visibility) {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(visibility);
  }
});

ipc.on("close-about", function() {
  if (aboutWindow) {
    aboutWindow.close();
  }
});

