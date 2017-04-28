const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const url = require('url')
const fs = require('fs')
const autoUpdater = require('electron-updater').autoUpdater
const autoUpdaterInterval = 60 * 60 * 1000;
const ipc = electron.ipcMain;
const Menu = electron.Menu;
const shell = electron.shell;

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

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 610,
    webPreferences: {
      nodeIntegration: false,
      //sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.on('focus', function() {
    mainWindow.flashFrame(false);
  });

  // Load locale
  const locale = 'en'; // FIXME
  const localeData = JSON.parse(fs.readFileSync(path.join(__dirname, '_locales', locale, 'messages.json'), 'utf-8'))
  ipc.on('locale-data', function(event, arg) {
    event.returnValue = localeData;
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'background.html'),
    protocol: 'file:',
    slashes: true,
    query: {
      locale: locale,
      version: package_json.version,
      buildExpiration: config.get('buildExpiration'),
      serverUrl: config.get('serverUrl'),
      environment: environment,
      node_version: process.versions.node
    }
  }))

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
    if (!shouldQuit) {
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
  if (!process.mas && !config.get('disableAutoUpdate')) {
    autoUpdater.addListener('update-downloaded', function() {
      autoUpdater.quitAndInstall()
    });
    autoUpdater.checkForUpdates();
    setInterval(function() { autoUpdater.checkForUpdates(); }, autoUpdaterInterval);
  }

  createWindow();

  let template = require('./menu.js');
  template[3].submenu[3].click = function() {
    mainWindow.show();
  };
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

})

app.on('before-quit', function() {
  shouldQuit = true;
});
// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
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
