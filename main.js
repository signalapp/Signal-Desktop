const path = require('path');
const url = require('url');
const os = require('os');

const _ = require('lodash');
const electron = require('electron')

const BrowserWindow = electron.BrowserWindow;
const Tray = electron.Tray;
const app = electron.app;
const ipc = electron.ipcMain;
const Menu = electron.Menu;
const shell = electron.shell;

const autoUpdate = require('./app/auto_update');
const windowState = require('./app/window_state');


console.log('setting AUMID');
app.setAppUserModelId('org.whispersystems.signal-desktop')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let trayHolder;

const config = require("./app/config");

if (config.environment === 'production' && !process.mas) {
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
    console.log('quitting');
    app.quit();
    return;
  }
}

const userConfig = require('./app/user_config');
const logging = require('./app/logging');

// this must be after we set up appPath in user_config.js
logging.initialize();
const logger = logging.getLogger();

let windowConfig = userConfig.get('window');
const loadLocale = require('./app/locale').load;

let locale;

function prepareURL(pathSegments) {
  return url.format({
    pathname: path.join.apply(null, pathSegments),
    protocol: 'file:',
    slashes: true,
    query: {
      locale: locale.name,
      version: app.getVersion(),
      buildExpiration: config.get('buildExpiration'),
      serverUrl: config.get('serverUrl'),
      cdnUrl: config.get('cdnUrl'),
      certificateAuthorities: config.get('certificateAuthorities'),
      environment: config.environment,
      node_version: process.versions.node,
      hostname: os.hostname(),
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

function createWindow () {
  const windowOptions = Object.assign({
    width: 800,
    height: 610,
    minWidth: 700,
    minHeight: 360,
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      //sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  }, windowConfig);

  if (windowOptions.fullscreen === false) {
    delete windowOptions.fullscreen;
  }

  logger.info('Initializing BrowserWindow config: %s', JSON.stringify(windowOptions));

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);

  // Create the tray icon with the default icon settings, unless on OSX - then use smaller icon
  var appIcon = new Tray(
    process.platform == "darwin" ? 
    path.join(__dirname, 'images', 'icon_16.png') : 
    path.join(__dirname, 'images', 'icon_256.png'));
  
  // Clicking on the tray icon will alternate between hidden/shown on Linux/Windows.
  appIcon.on('click', function () {
    trayHolder.handleTrayStateClick();
  });
  appIcon.setToolTip(locale.messages.trayTip.message);

  trayHolder = {
    // Returns one of two locale messages based on current window state
    getTrayStateLabel : function() {
      if (mainWindow.isVisible())
        return locale.messages.hide.message
      else
        return locale.messages.show.message
    },
    // Returns one of two tray menu templates based on state
    getTrayTemplate: function () {
      if (trayHolder.isTrayMinimizeAllowed) {
        return Menu.buildFromTemplate([
          {
            label: trayHolder.getTrayStateLabel(), click: function () {
              trayHolder.handleTrayStateClick();
            }
          },
          {
            label: locale.messages.quit.message, click: function () {
              windowState.markShouldQuit();
              app.quit();
            }
        }]);
      } else {
        return Menu.buildFromTemplate([
          {
            label: locale.messages.quit.message, click: function () {
              windowState.markShouldQuit();
              app.quit();
            }
        }]);
      }
    },
    // Handles tray state clicks and updates menu accordingly.
    handleTrayStateClick : function(updateMenuOnly = false) {
      if (!updateMenuOnly && trayHolder.isTrayMinimizeAllowed) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      } else if (!updateMenuOnly && !trayHolder.isTrayMinimizeAllowed) {
        mainWindow.isMinimized() || isMinimizing ? mainWindow.minimize() : mainWindow.show();
      }
    
      trayHolder.tray.setContextMenu(trayHolder.getTrayTemplate());
    },
    setTrayMinimizeAllowed: function(trayMinimizedAllowed) {
      trayHolder.isTrayMinimizeAllowed = trayMinimizedAllowed;
      trayHolder.handleTrayStateClick(true);
    },
    isTrayMinimizeAllowed: false,
    tray: appIcon
  } 
  
  // Run tray state click handler once for initial setup
  trayHolder.handleTrayStateClick(true);

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

  // Emitted when the window is about to be minimized.
  mainWindow.on('minimize', function(event) {
    trayHolder.handleTrayStateClick(true);
  })
  
  // Highlight tray icon when window is open
  mainWindow.on('show', function() {
    appIcon.setHighlightMode('always');
  });

  // Un-highlight tray icon when window is hidden
  mainWindow.on('hide', function() {
    appIcon.setHighlightMode('never');
    trayHolder.handleTrayStateClick(true);
  });



  // Emitted when the window is about to be closed.
  mainWindow.on('close', function (e) {
    if (!windowState.shouldQuit() && config.environment !== 'test' && trayHolder.isTrayMinimizeAllowed) {
      e.preventDefault();
      mainWindow.hide();
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
    }
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
app.on('ready', function() {
  logger.info('app ready');

  if (!locale) {
    locale = loadLocale();
  }

  autoUpdate.initialize(locale.messages);

  createWindow();

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

app.on('activate', function () {
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
  }
});

ipc.on('restart', function(event) {
  app.relaunch();
  app.quit();
});

ipc.on("set-auto-hide-menu-bar", function(event, autoHide) {
  mainWindow.setAutoHideMenuBar(autoHide);
});

ipc.on("set-menu-bar-visibility", function(event, visibility) {
  mainWindow.setMenuBarVisibility(visibility);
});

ipc.on("set-allow-tray-minimize", function(event, allowTrayMinimize) {
  trayHolder.setTrayMinimizeAllowed(allowTrayMinimize);
});
