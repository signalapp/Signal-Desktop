/* global Whisper: false */
/* global window: false */

console.log('preload');

const electron = require('electron');

const { deferredToPromise } = require('./js/modules/deferred_to_promise');

const { app } = electron.remote;

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

window.wrapDeferred = deferredToPromise;

const ipc = electron.ipcRenderer;
const localeMessages = ipc.sendSync('locale-data');

window.setBadgeCount = count => ipc.send('set-badge-count', count);

// We never do these in our code, so we'll prevent it everywhere
window.open = () => null;
// eslint-disable-next-line no-eval, no-multi-assign
window.eval = global.eval = () => null;

window.drawAttention = () => {
  console.log('draw attention');
  ipc.send('draw-attention');
};
window.showWindow = () => {
  console.log('show window');
  ipc.send('show-window');
};

window.setAutoHideMenuBar = autoHide =>
  ipc.send('set-auto-hide-menu-bar', autoHide);

window.setMenuBarVisibility = visibility =>
  ipc.send('set-menu-bar-visibility', visibility);

window.restart = () => {
  console.log('restart');
  ipc.send('restart');
};

window.closeAbout = () => ipc.send('close-about');

window.updateTrayIcon = unreadCount =>
  ipc.send('update-tray-icon', unreadCount);

ipc.on('debug-log', () => {
  Whisper.events.trigger('showDebugLog');
});

ipc.on('set-up-with-import', () => {
  Whisper.events.trigger('setupWithImport');
});

ipc.on('set-up-as-new-device', () => {
  Whisper.events.trigger('setupAsNewDevice');
});

ipc.on('set-up-as-standalone', () => {
  Whisper.events.trigger('setupAsStandalone');
});

ipc.on('show-settings', () => {
  Whisper.events.trigger('showSettings');
});

window.addSetupMenuItems = () => ipc.send('add-setup-menu-items');

window.removeSetupMenuItems = () => ipc.send('remove-setup-menu-items');

// We pull these dependencies in now, from here, because they have Node.js dependencies

require('./js/logging');

if (config.proxyUrl) {
  console.log('using proxy url', config.proxyUrl);
}

window.nodeSetImmediate = setImmediate;

const { initialize: initializeWebAPI } = require('./js/modules/web_api');

window.WebAPI = initializeWebAPI({
  url: config.serverUrl,
  cdnUrl: config.cdnUrl,
  certificateAuthority: config.certificateAuthority,
  proxyUrl: config.proxyUrl,
});

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

// Note: when modifying this file, consider whether our React Components or Backbone Views
//   will need these things to render in the Style Guide. If so, go update one of these
//   two locations:
//
//   1) test/styleguide/legacy_bridge.js
//   2) ts/styleguide/StyleGuideUtil.js

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');

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
});

// Pulling these in separately since they access filesystem, electron
window.Signal.Backup = require('./js/modules/backup');
window.Signal.Debug = require('./js/modules/debug');
window.Signal.Logs = require('./js/modules/logs');

// We pull this in last, because the native module involved appears to be sensitive to
//   /tmp mounted as noexec on Linux.
require('./js/spell_check');

if (config.environment === 'test') {
  /* eslint-disable global-require, import/no-extraneous-dependencies */
  window.test = {
    glob: require('glob'),
    fse: require('fs-extra'),
    tmp: require('tmp'),
    path: require('path'),
    basePath: __dirname,
    attachmentsPath: window.Signal.Migrations.attachmentsPath,
  };
  /* eslint-enable global-require, import/no-extraneous-dependencies */
}
