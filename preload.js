/* eslint-disable global-require */
/* global Whisper: false */
/* global window: false */
const path = require('path');
const { webFrame, remote, clipboard, ipcRenderer } = require('electron');

const { app } = remote;
const url = require('url');

const config = url.parse(window.location.toString(), true).query;

let title = config.name;
if (config.environment !== 'production') {
  title += ` - ${config.environment}`;
}
if (config.appInstance) {
  title += ` - ${config.appInstance}`;
}

global.dcodeIO = global.dcodeIO || {};
global.dcodeIO.ByteBuffer = require('bytebuffer');

window.platform = process.platform;
window.getTitle = () => title;
window.getEnvironment = () => config.environment;
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.isDev = () => config.environment === 'development';
window.getCommitHash = () => config.commitHash;
window.getNodeVersion = () => config.node_version;

window.sessionFeatureFlags = {
  useOnionRequests: true,
  useCallMessage: false,
};

window.versionInfo = {
  environment: window.getEnvironment(),
  version: window.getVersion(),
  commitHash: window.getCommitHash(),
  appInstance: window.getAppInstance(),
};

const ipc = ipcRenderer;
const localeMessages = ipc.sendSync('locale-data');

window.updateZoomFactor = () => {
  const zoomFactor = window.getSettingValue('zoom-factor-setting') || 100;
  window.setZoomFactor(zoomFactor / 100);
};

window.setZoomFactor = number => {
  webFrame.setZoomFactor(number);
};

// Set the password for the database
window.setPassword = (passPhrase, oldPhrase) =>
  new Promise((resolve, reject) => {
    ipc.once('set-password-response', (event, error) => {
      if (error) {
        return reject(error);
      }
      Whisper.events.trigger('password-updated');
      return resolve();
    });
    ipc.send('set-password', passPhrase, oldPhrase);
  });

window.setStartInTray = startInTray =>
  new Promise((resolve, reject) => {
    ipc.once('start-in-tray-on-start-response', (_event, error) => {
      if (error) {
        return reject(error);
      }
      return resolve();
    });
    ipc.send('start-in-tray-on-start', startInTray);
  });

window.getStartInTray = () =>
  new Promise(resolve => {
    ipc.once('get-start-in-tray-response', (event, value) => resolve(value));
    ipc.send('get-start-in-tray');
  });

window.libsession = require('./ts/session');
window._ = require('lodash');

window.getConversationController = window.libsession.Conversations.getConversationController;

// We never do these in our code, so we'll prevent it everywhere
window.open = () => null;
// eslint-disable-next-line no-eval, no-multi-assign
window.eval = global.eval = () => null;

window.drawAttention = () => {
  // window.log.debug('draw attention');
  ipc.send('draw-attention');
};
window.showWindow = () => {
  window.log.info('show window');
  ipc.send('show-window');
};

window.setAutoHideMenuBar = autoHide => ipc.send('set-auto-hide-menu-bar', autoHide);

window.setMenuBarVisibility = visibility => ipc.send('set-menu-bar-visibility', visibility);

window.restart = () => {
  window.log.info('restart');
  ipc.send('restart');
};

window.closeAbout = () => ipc.send('close-about');
window.readyForUpdates = () => ipc.send('ready-for-updates');

ipc.on('get-theme-setting', () => {
  const theme = window.Events.getThemeSetting();
  ipc.send('get-success-theme-setting', theme);
});

window.getSettingValue = (settingID, comparisonValue = null) => {
  // Comparison value allows you to pull boolean values from any type.
  // Eg. window.getSettingValue('theme', 'light')
  // returns 'false' when the value is 'dark'.

  // We need to get specific settings from the main process
  if (settingID === 'media-permissions') {
    return window.getMediaPermissions();
  } else if (settingID === 'call-media-permissions') {
    return window.getCallMediaPermissions();
  } else if (settingID === 'auto-update') {
    return window.getAutoUpdateEnabled();
  }

  const settingVal = window.storage.get(settingID);
  return comparisonValue ? !!settingVal === comparisonValue : settingVal;
};

window.setSettingValue = (settingID, value) => {
  // For auto updating we need to pass the value to the main process
  if (settingID === 'auto-update') {
    window.setAutoUpdateEnabled(value);
    return;
  }

  window.storage.put(settingID, value);
};

window.getMediaPermissions = () => ipc.sendSync('get-media-permissions');
window.setMediaPermissions = value => ipc.send('set-media-permissions', !!value);

window.getCallMediaPermissions = () => ipc.sendSync('get-call-media-permissions');
window.setCallMediaPermissions = value => ipc.send('set-call-media-permissions', !!value);

window.askForMediaAccess = () => ipc.send('media-access');

// Auto update setting
window.getAutoUpdateEnabled = () => ipc.sendSync('get-auto-update-setting');
window.setAutoUpdateEnabled = value => ipc.send('set-auto-update-setting', !!value);

ipc.on('get-ready-for-shutdown', async () => {
  const { shutdown } = window.Events || {};
  if (!shutdown) {
    window.log.error('preload shutdown handler: shutdown method not found');
    ipc.send('now-ready-for-shutdown');
    return;
  }

  try {
    await shutdown();
    ipc.send('now-ready-for-shutdown');
  } catch (error) {
    ipc.send('now-ready-for-shutdown', error && error.stack ? error.stack : error);
  }
});

// We pull these dependencies in now, from here, because they have Node.js dependencies

require('./js/logging');

if (config.proxyUrl) {
  window.log.info('Using provided proxy url');
}
window.nodeSetImmediate = setImmediate;

const Signal = require('./js/modules/signal');
const i18n = require('./js/modules/i18n');

window.Signal = Signal.setup();

window.getSwarmPollingInstance = require('./ts/session/apis/snode_api/').getSwarmPollingInstance;

const WorkerInterface = require('./js/modules/util_worker_interface');

// A Worker with a 3 minute timeout
const utilWorkerPath = path.join(app.getAppPath(), 'js', 'util_worker.js');
const utilWorker = new WorkerInterface(utilWorkerPath, 3 * 60 * 1000);

window.callWorker = (fnName, ...args) => utilWorker.callWorker(fnName, ...args);
// Linux seems to periodically let the event loop stop, so this is a global workaround
setInterval(() => {
  window.nodeSetImmediate(() => {});
}, 1000);

window.loadImage = require('blueimp-load-image');
window.filesize = require('filesize');

window.React = require('react');
window.ReactDOM = require('react-dom');

window.clipboard = clipboard;

window.getSeedNodeList = () => JSON.parse(config.seedNodeList);

const { locale: localFromEnv } = config;
window.i18n = i18n.setup(localFromEnv, localeMessages);
window.moment = require('moment');
window.libsession = require('./ts/session');

window.Signal.Data = require('./ts/data/data');

window.Signal.Logs = require('./js/modules/logs');

window.addEventListener('contextmenu', e => {
  const editable = e.target.closest('textarea, input, [contenteditable="true"]');
  const link = e.target.closest('a');
  const selection = Boolean(window.getSelection().toString());
  if (!editable && !selection && !link) {
    e.preventDefault();
  }
});

window.NewReceiver = require('./ts/receiver/receiver');

// Blocking

const { BlockedNumberController } = require('./ts/util/blockedNumberController');

window.BlockedNumberController = BlockedNumberController;
