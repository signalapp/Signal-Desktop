/* global Whisper: false */
/* global window: false */
const path = require('path');
const electron = require('electron');
const semver = require('semver');

const { deferredToPromise } = require('./js/modules/deferred_to_promise');

const { app } = electron.remote;
const { clipboard } = electron;

window.PROTO_ROOT = 'protos';
const config = require('url').parse(window.location.toString(), true).query;

let title = config.name;
if (config.environment !== 'production') {
  title += ` - ${config.environment}`;
}
if (config.appInstance) {
  title += ` - ${config.appInstance}`;
}

window.getTitle = () => title;
window.getEnvironment = () => config.environment;
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.isImportMode = () => config.importMode;
window.getExpiration = () => config.buildExpiration;
window.getNodeVersion = () => config.node_version;
window.getHostName = () => config.hostname;
window.getServerTrustRoot = () => config.serverTrustRoot;
window.isBehindProxy = () => Boolean(config.proxyUrl);

window.isBeforeVersion = (toCheck, baseVersion) => {
  try {
    return semver.lt(toCheck, baseVersion);
  } catch (error) {
    window.log.error(
      `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
      error && error.stack ? error.stack : error
    );
    return true;
  }
};

window.wrapDeferred = deferredToPromise;

const ipc = electron.ipcRenderer;
const localeMessages = ipc.sendSync('locale-data');

window.setBadgeCount = count => ipc.send('set-badge-count', count);

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

// We never do these in our code, so we'll prevent it everywhere
window.open = () => null;
// eslint-disable-next-line no-eval, no-multi-assign
window.eval = global.eval = () => null;

window.drawAttention = () => {
  window.log.info('draw attention');
  ipc.send('draw-attention');
};
window.showWindow = () => {
  window.log.info('show window');
  ipc.send('show-window');
};

window.setAutoHideMenuBar = autoHide =>
  ipc.send('set-auto-hide-menu-bar', autoHide);

window.setMenuBarVisibility = visibility =>
  ipc.send('set-menu-bar-visibility', visibility);

window.restart = () => {
  window.log.info('restart');
  ipc.send('restart');
};

window.setMediaPermissions = enabled =>
  ipc.send('set-media-permissions', enabled);
window.getMediaPermissions = () => ipc.sendSync('get-media-permissions');

// Events for updating block number states across different windows.
// In this case we need these to update the blocked number
//  collection on the main window from the settings window.
window.onUnblockNumber = number => ipc.send('on-unblock-number', number);

ipc.on('on-unblock-number', (event, number) => {
  // Unblock the number
  if (window.BlockedNumberController) {
    window.BlockedNumberController.unblock(number);
  }

  // Update the conversation
  if (window.ConversationController) {
    try {
      const conversation = window.ConversationController.get(number);
      conversation.unblock();
    } catch (e) {
      window.log.info(
        'IPC on unblock: failed to fetch conversation for number: ',
        number
      );
    }
  }
});

window.closeAbout = () => ipc.send('close-about');

window.updateTrayIcon = unreadCount =>
  ipc.send('update-tray-icon', unreadCount);

ipc.on('set-up-with-import', () => {
  Whisper.events.trigger('setupWithImport');
});

ipc.on('set-up-as-new-device', () => {
  Whisper.events.trigger('setupAsNewDevice');
});

ipc.on('set-up-as-standalone', () => {
  Whisper.events.trigger('setupAsStandalone');
});

// Settings-related events

window.showSettings = () => ipc.send('show-settings');
window.showPermissionsPopup = () => ipc.send('show-permissions-popup');

ipc.on('add-dark-overlay', () => {
  const { addDarkOverlay } = window.Events;
  if (addDarkOverlay) {
    addDarkOverlay();
  }
});
ipc.on('remove-dark-overlay', () => {
  const { removeDarkOverlay } = window.Events;
  if (removeDarkOverlay) {
    removeDarkOverlay();
  }
});

installGetter('device-name', 'getDeviceName');

installGetter('theme-setting', 'getThemeSetting');
installSetter('theme-setting', 'setThemeSetting');
installGetter('hide-menu-bar', 'getHideMenuBar');
installSetter('hide-menu-bar', 'setHideMenuBar');

// Get the message TTL setting
window.getMessageTTL = () => window.storage.get('message-ttl', 24);
installGetter('message-ttl', 'getMessageTTL');
installSetter('message-ttl', 'setMessageTTL');

installGetter('read-receipt-setting', 'getReadReceiptSetting');
installSetter('read-receipt-setting', 'setReadReceiptSetting');
installGetter('notification-setting', 'getNotificationSetting');
installSetter('notification-setting', 'setNotificationSetting');
installGetter('audio-notification', 'getAudioNotification');
installSetter('audio-notification', 'setAudioNotification');

installGetter('link-preview-setting', 'getLinkPreviewSetting');
installSetter('link-preview-setting', 'setLinkPreviewSetting');

installGetter('spell-check', 'getSpellCheck');
installSetter('spell-check', 'setSpellCheck');

window.getMediaPermissions = () =>
  new Promise((resolve, reject) => {
    ipc.once('get-success-media-permissions', (_event, error, value) => {
      if (error) {
        return reject(error);
      }

      return resolve(value);
    });
    ipc.send('get-media-permissions');
  });

installGetter('is-primary', 'isPrimary');
installGetter('sync-request', 'getSyncRequest');
installGetter('sync-time', 'getLastSyncTime');
installSetter('sync-time', 'setLastSyncTime');

ipc.on('delete-all-data', () => {
  const { deleteAllData } = window.Events;
  if (deleteAllData) {
    deleteAllData();
  }
});

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
    ipc.send(
      'now-ready-for-shutdown',
      error && error.stack ? error.stack : error
    );
  }
});

function installGetter(name, functionName) {
  ipc.on(`get-${name}`, async () => {
    const getFn = window.Events[functionName];
    if (!getFn) {
      ipc.send(
        `get-success-${name}`,
        `installGetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      ipc.send(`get-success-${name}`, null, await getFn());
    } catch (error) {
      ipc.send(
        `get-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

function installSetter(name, functionName) {
  ipc.on(`set-${name}`, async (_event, value) => {
    const setFn = window.Events[functionName];
    if (!setFn) {
      ipc.send(
        `set-success-${name}`,
        `installSetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      await setFn(value);
      ipc.send(`set-success-${name}`);
    } catch (error) {
      ipc.send(
        `set-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

window.addSetupMenuItems = () => ipc.send('add-setup-menu-items');
window.removeSetupMenuItems = () => ipc.send('remove-setup-menu-items');

// We pull these dependencies in now, from here, because they have Node.js dependencies

require('./js/logging');

if (config.proxyUrl) {
  window.log.info('Using provided proxy url');
}

window.nodeSetImmediate = setImmediate;

const { initialize: initializeWebAPI } = require('./js/modules/web_api');

window.WebAPI = initializeWebAPI({
  url: config.serverUrl,
  cdnUrl: config.cdnUrl,
  certificateAuthority: config.certificateAuthority,
  contentProxyUrl: config.contentProxyUrl,
  proxyUrl: config.proxyUrl,
});

const LokiSnodeAPI = require('./js/modules/loki_snode_api');

window.lokiSnodeAPI = new LokiSnodeAPI({
  serverUrl: config.serverUrl,
  localUrl: config.localUrl,
  swarmServerPort: config.swarmServerPort,
});

window.LokiP2pAPI = require('./js/modules/loki_p2p_api');

const LokiMessageAPI = require('./js/modules/loki_message_api');

window.lokiMessageAPI = new LokiMessageAPI({
  url: config.serverUrl,
  messageServerPort: config.messageServerPort,
});

const LocalLokiServer = require('./libloki/local_loki_server');

window.localServerPort = config.localServerPort;
window.localLokiServer = new LocalLokiServer();

window.mnemonic = require('./libloki/mnemonic');
const WorkerInterface = require('./js/modules/util_worker_interface');

// A Worker with a 3 minute timeout
const utilWorkerPath = path.join(app.getAppPath(), 'js', 'util_worker.js');
const utilWorker = new WorkerInterface(utilWorkerPath, 3 * 60 * 1000);
window.callWorker = (fnName, ...args) => utilWorker.callWorker(fnName, ...args);

// Linux seems to periodically let the event loop stop, so this is a global workaround
setInterval(() => {
  window.nodeSetImmediate(() => {});
}, 1000);

const { autoOrientImage } = require('./js/modules/auto_orient_image');

window.autoOrientImage = autoOrientImage;
window.dataURLToBlobSync = require('blueimp-canvas-to-blob');
window.emojiData = require('emoji-datasource');
window.EmojiPanel = require('emoji-panel');
window.filesize = require('filesize');
window.libphonenumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
window.libphonenumber.PhoneNumberFormat = require('google-libphonenumber').PhoneNumberFormat;
window.loadImage = require('blueimp-load-image');
window.getGuid = require('uuid/v4');
window.profileImages = require('./app/profile_images');
window.passwordUtil = require('./app/password_util');

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');

window.clipboard = clipboard;

const Signal = require('./js/modules/signal');
const i18n = require('./js/modules/i18n');
const Attachments = require('./app/attachments');

const { locale } = config;
window.i18n = i18n.setup(locale, localeMessages);
window.moment.updateLocale(locale, {
  relativeTime: {
    s: window.i18n('timestamp_s'),
    m: window.i18n('timestamp_m'),
    h: window.i18n('timestamp_h'),
  },
});
window.moment.locale(locale);

window.Signal = Signal.setup({
  Attachments,
  userDataPath: app.getPath('userData'),
  getRegionCode: () => window.storage.get('regionCode'),
  logger: window.log,
});

// Pulling these in separately since they access filesystem, electron
window.Signal.Backup = require('./js/modules/backup');
window.Signal.Debug = require('./js/modules/debug');
window.Signal.Logs = require('./js/modules/logs');

// We pull this in last, because the native module involved appears to be sensitive to
//   /tmp mounted as noexec on Linux.
require('./js/spell_check');

if (config.environment === 'test') {
  const isTravis = 'TRAVIS' in process.env && 'CI' in process.env;
  const isWindows = process.platform === 'win32';
  /* eslint-disable global-require, import/no-extraneous-dependencies */
  window.test = {
    glob: require('glob'),
    fse: require('fs-extra'),
    tmp: require('tmp'),
    path: require('path'),
    basePath: __dirname,
    attachmentsPath: window.Signal.Migrations.attachmentsPath,
    isTravis,
    isWindows,
  };
  /* eslint-enable global-require, import/no-extraneous-dependencies */
}
