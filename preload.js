/* global Whisper: false */
/* global window: false */
const path = require('path');
const electron = require('electron');

const { webFrame } = electron;
const semver = require('semver');

const { deferredToPromise } = require('./js/modules/deferred_to_promise');
const { JobQueue } = require('./js/modules/job_queue');

const { app } = electron.remote;
const { clipboard } = electron;

window.PROTO_ROOT = 'protos';
const appConfig = require('./app/config');
const config = require('url').parse(window.location.toString(), true).query;

let title = config.name;
if (config.environment !== 'production') {
  title += ` - ${config.environment}`;
}
if (config.appInstance) {
  title += ` - ${config.appInstance}`;
}

window.Lodash = require('lodash');

// Regex to match all characters which are *not* supported in display names
window.displayNameRegex = /[^\u0041-\u005A\u0061-\u007A\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC _0-9]*/g;

window.semver = semver;
window.platform = process.platform;
window.getDefaultPoWDifficulty = () => config.defaultPoWDifficulty;
window.getTitle = () => title;
window.getEnvironment = () => config.environment;
window.isDev = () => config.environment === 'development';
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.isImportMode = () => config.importMode;
window.getExpiration = () => config.buildExpiration;
window.getCommitHash = () => config.commitHash;
window.getNodeVersion = () => config.node_version;
window.getHostName = () => config.hostname;
window.getServerTrustRoot = () => config.serverTrustRoot;
window.isBehindProxy = () => Boolean(config.proxyUrl);
window.JobQueue = JobQueue;
window.getStoragePubKey = key =>
  window.isDev() ? key.substring(0, key.length - 2) : key;
window.getDefaultFileServer = () => config.defaultFileServer;
window.initialisedAPI = false;

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

window.CONSTANTS = {
  MAX_LOGIN_TRIES: 3,
  MAX_PASSWORD_LENGTH: 32,
  MAX_USERNAME_LENGTH: 20,
  MAX_GROUP_NAME_LENGTH: 64,
  DEFAULT_PUBLIC_CHAT_URL: appConfig.get('defaultPublicChatServer'),
  MAX_CONNECTION_DURATION: 5000,
  MAX_MESSAGE_BODY_LENGTH: 64 * 1024,
  // Limited due to the proof-of-work requirement
  SMALL_GROUP_SIZE_LIMIT: 10,
  NOTIFICATION_ENABLE_TIMEOUT_SECONDS: 10, // number of seconds to turn on notifications after reconnect/start of app
};

window.versionInfo = {
  environment: window.getEnvironment(),
  version: window.getVersion(),
  commitHash: window.getCommitHash(),
  appInstance: window.getAppInstance(),
};

window.wrapDeferred = deferredToPromise;

const ipc = electron.ipcRenderer;
const localeMessages = ipc.sendSync('locale-data');

window.updateZoomFactor = () => {
  const zoomFactor = window.getSettingValue('zoom-factor-setting') || 100;
  window.setZoomFactor(zoomFactor / 100);
};

window.setZoomFactor = number => {
  webFrame.setZoomFactor(number);
};

window.getZoomFactor = () => {
  webFrame.getZoomFactor();
};

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

window.passwordUtil = require('./app/password_util');

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

window.resetDatabase = () => {
  window.log.info('reset database');
  ipc.send('resetDatabase');
};

// Events for updating block number states across different windows.
// In this case we need these to update the blocked number
//  collection on the main window from the settings window.
window.onUnblockNumber = number => ipc.send('on-unblock-number', number);

ipc.on('mediaPermissionsChanged', () => {
  Whisper.events.trigger('mediaPermissionsChanged');
});

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
window.readyForUpdates = () => ipc.send('ready-for-updates');

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

window.getSettingValue = (settingID, comparisonValue = null) => {
  // Comparison value allows you to pull boolean values from any type.
  // Eg. window.getSettingValue('theme', 'light')
  // returns 'false' when the value is 'dark'.

  if (settingID === 'media-permissions') {
    let permissionValue;
    // eslint-disable-next-line more/no-then
    window.getMediaPermissions().then(value => {
      permissionValue = value;
    });

    return permissionValue;
  }

  const settingVal = window.storage.get(settingID);
  return comparisonValue ? !!settingVal === comparisonValue : settingVal;
};

window.setSettingValue = (settingID, value) => {
  window.storage.put(settingID, value);

  if (settingID === 'zoom-factor-setting') {
    window.updateZoomFactor();
  }
};

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

installGetter('typing-indicators-setting', 'getTypingIndicatorsSetting');
installSetter('typing-indicators-setting', 'setTypingIndicatorsSetting');

installGetter('notification-setting', 'getNotificationSetting');
installSetter('notification-setting', 'setNotificationSetting');
installGetter('audio-notification', 'getAudioNotification');
installSetter('audio-notification', 'setAudioNotification');

installGetter('link-preview-setting', 'getLinkPreviewSetting');
installSetter('link-preview-setting', 'setLinkPreviewSetting');

installGetter('spell-check', 'getSpellCheck');
installSetter('spell-check', 'setSpellCheck');

installGetter('media-permissions', 'getMediaPermissions');
installGetter('media-permissions', 'setMediaPermissions');

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

window.seedNodeList = JSON.parse(config.seedNodeList);
const LokiSnodeAPI = require('./js/modules/loki_snode_api');

window.lokiSnodeAPI = new LokiSnodeAPI({
  serverUrl: config.serverUrl,
  localUrl: config.localUrl,
});

window.LokiMessageAPI = require('./js/modules/loki_message_api');

window.LokiPublicChatAPI = require('./js/modules/loki_public_chat_api');

window.LokiAppDotNetServerAPI = require('./js/modules/loki_app_dot_net_api');

window.LokiFileServerAPI = require('./js/modules/loki_file_server_api');

window.LokiRssAPI = require('./js/modules/loki_rss_api');

window.localServerPort = config.localServerPort;

window.mnemonic = require('./libloki/modules/mnemonic');
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

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');

const _sodium = require('libsodium-wrappers');

window.getSodium = async () => {
  await _sodium.ready;
  return _sodium;
};

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

// Add right-click listener for selected text and urls
const contextMenu = require('electron-context-menu');

const isQR = params =>
  params.mediaType === 'image' && params.titleText === 'Scan me!';

// QR saving doesn't work so we just disable it
contextMenu({
  showInspectElement: false,
  shouldShowMenu: (event, params) => {
    const isRegular =
      params.mediaType === 'none' && (params.linkURL || params.selectionText);
    return Boolean(!params.isEditable && (isQR(params) || isRegular));
  },
  menu: (actions, params) => {
    // If it's not a QR then show the default options
    if (!isQR(params)) {
      return actions;
    }

    return [actions.copyImage()];
  },
});

// We pull this in last, because the native module involved appears to be sensitive to
//   /tmp mounted as noexec on Linux.
require('./js/spell_check');

window.shortenPubkey = pubkey => `(...${pubkey.substring(pubkey.length - 6)})`;

window.pubkeyPattern = /@[a-fA-F0-9]{64,66}\b/g;

// TODO: activate SealedSender once it is ready on all platforms
window.lokiFeatureFlags = {
  multiDeviceUnpairing: true,
  privateGroupChats: true,
  useSnodeProxy: true,
  useSealedSender: true,
};

// eslint-disable-next-line no-extend-native,func-names
Promise.prototype.ignore = function() {
  // eslint-disable-next-line more/no-then
  this.then(() => {});
};

if (config.environment.includes('test')) {
  const isWindows = process.platform === 'win32';
  /* eslint-disable global-require, import/no-extraneous-dependencies */
  window.test = {
    glob: require('glob'),
    fse: require('fs-extra'),
    tmp: require('tmp'),
    path: require('path'),
    basePath: __dirname,
    attachmentsPath: window.Signal.Migrations.attachmentsPath,
    isWindows,
  };
  /* eslint-enable global-require, import/no-extraneous-dependencies */
  window.lokiFeatureFlags = {};
  window.lokiSnodeAPI = {
    refreshSwarmNodesForPubKey: () => [],
    getFreshSwarmNodes: () => [],
    updateSwarmNodes: () => {},
    updateLastHash: () => {},
    getSwarmNodesForPubKey: () => [],
  };
}
