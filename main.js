const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const url = require('url')
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
let windowConfig = userConfig.get('window');

const loadLocale = require('./app/locale').load;
let locale;

function createWindow () {
  const windowOptions = Object.assign({
    width: 800,
    height: 610,
    minWidth: 700,
    minHeight: 360,
    webPreferences: {
      nodeIntegration: false,
      //sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  }, windowConfig);

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);

  function captureAndSaveWindowStats() {
    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      fullscreen: mainWindow.isFullScreen(),
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1]
    };

    userConfig.set('window', windowConfig);
  }

  mainWindow.on('resize', captureAndSaveWindowStats);
  mainWindow.on('move', captureAndSaveWindowStats);

  mainWindow.on('focus', function() {
    mainWindow.flashFrame(false);
  });

  // Ingested in preload.js via a sendSync call
  ipc.on('locale-data', function(event, arg) {
    event.returnValue = locale.messages;
  });

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
        node_version: process.versions.node
      }
    })
  }

  if (config.environment === 'test') {
    mainWindow.loadURL(prepareURL([__dirname, 'test', 'index.html']));
  } else {
    mainWindow.loadURL(prepareURL([__dirname, 'background.html']));
  }

  if (config.get('openDevTools')) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  }

  mainWindow.webContents.on('new-window', (e, url) => {
      e.preventDefault();
      const protocol = require('url').parse(url).protocol
      if (protocol === 'http:' || protocol === 'https:') {
            shell.openExternal(url)
      }
  });

  mainWindow.webContents.on('will-navigate', function(e) {
    console.log('will-navigate');
    e.preventDefault();
  });

  // Emitted when the window is about to be closed.
  mainWindow.on('close', function (e) {
    if (process.platform === 'darwin' && !windowState.shouldQuit() && config.environment !== 'test') {
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
  console.log('app ready');

  if (!locale) {
    locale = loadLocale();
  }

  autoUpdate.initialize(locale.messages);

  createWindow();

  let template = require('./app/menu.js');

  if (process.platform === 'darwin') {
    template[3].submenu[3].click = function() {
      mainWindow.show();
    };
    template[2].submenu[0].click = showDebugLog;
  } else {
    template[1].submenu[0].click = showDebugLog;
  }

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
  if (process.platform !== 'darwin' || config.environment === 'test') {
    app.quit()
  }
})

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
