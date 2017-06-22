const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const url = require('url')
const fs = require('fs')
const ipc = electron.ipcMain;
const Menu = electron.Menu;
const shell = electron.shell;
const ElectronConfig = require('electron-config');

const autoupdate = require('./autoupdate');
const locale = require('./locale');
const windowState = require('./window_state');

console.log('setting AUMID');
app.setAppUserModelId('org.whispersystems.signal-desktop')

console.log('reading package.json');
const package_json = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
const environment = package_json.environment || process.env.NODE_ENV || 'development';

if (environment === 'production' && !process.mas) {
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

console.log('configuring');
// Set environment vars to configure node-config before requiring it
process.env.NODE_ENV = environment;
process.env.NODE_CONFIG_DIR = path.join(__dirname, 'config');
if (environment === 'production') {
  // harden production config against the local env
  process.env.NODE_CONFIG = '';
  process.env.NODE_CONFIG_STRICT_MODE = true;
  process.env.HOSTNAME = '';
  process.env.NODE_APP_INSTANCE = '';
  process.env.ALLOW_CONFIG_MUTATIONS = '';
  process.env.SUPPRESS_NO_CONFIG_WARNING = '';
}
const config = require('config');
// Log resulting env vars in use by config
[
  'NODE_ENV',
  'NODE_CONFIG_DIR',
  'NODE_CONFIG',
  'ALLOW_CONFIG_MUTATIONS',
  'HOSTNAME',
  'NODE_APP_INSTANCE',
  'SUPPRESS_NO_CONFIG_WARNING'
].forEach(function(s) {
  console.log(s + ' ' + config.util.getEnv(s));
});

// use a separate data directory for development
if (config.has('storageProfile')) {
  var userData = path.join(app.getPath('appData'), 'Signal-' + config.get('storageProfile'));
  app.setPath('userData', userData);
}
console.log('userData ' + app.getPath('userData'));

// this needs to be below our update to the appData path
const userConfig = new ElectronConfig();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let windowConfig = userConfig.get('window');


// Load locale - if we can't load messages for the current locale, we
// default to 'en'
//
// possible locales:
// https://github.com/electron/electron/blob/master/docs/api/locales.md
let localeName = locale.normalizeLocaleName(app.getLocale());
let messages;

try {
  messages = locale.getLocaleMessages(localeName);
} catch (e) {
  console.log('Problem loading messages for locale ', localeName, e.stack);
  console.log('Falling back to en locale');

  localeName = 'en';
  messages = locale.getLocaleMessages(localeName);
}

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
    event.returnValue = messages;
  });

  function prepareURL(pathSegments) {
    return url.format({
      pathname: path.join.apply(null, pathSegments),
      protocol: 'file:',
      slashes: true,
      query: {
        locale: localeName,
        version: app.getVersion(),
        buildExpiration: config.get('buildExpiration'),
        serverUrl: config.get('serverUrl'),
        environment: environment,
        node_version: process.versions.node
      }
    })
  }

  if (environment === 'test') {
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
    if (process.platform === 'darwin' && !windowState.shouldQuit() && environment !== 'test') {
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
    mainWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
  console.log('app ready');

  autoupdate.initializeAutoUpdater(config, messages);

  createWindow();

  let template = require('./menu.js');
  if (process.platform === 'darwin') {
    template[3].submenu[3].click = function() {
      mainWindow.show();
    };
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
  if (process.platform !== 'darwin' || environment === 'test') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
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
