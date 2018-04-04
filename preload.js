/* global Whisper: false */
/* global window: false */

console.log('preload');

const electron = require('electron');

const Attachment = require('./js/modules/types/attachment');
const Attachments = require('./app/attachments');
const Message = require('./js/modules/types/message');
const { deferredToPromise } = require('./js/modules/deferred_to_promise');

const { app } = electron.remote;


window.PROTO_ROOT = 'protos';
window.config = require('url').parse(window.location.toString(), true).query;

window.wrapDeferred = deferredToPromise;

const ipc = electron.ipcRenderer;
window.config.localeMessages = ipc.sendSync('locale-data');

window.setBadgeCount = count =>
  ipc.send('set-badge-count', count);

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

window.closeAbout = () =>
  ipc.send('close-about');

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

window.addSetupMenuItems = () =>
  ipc.send('add-setup-menu-items');

window.removeSetupMenuItems = () =>
  ipc.send('remove-setup-menu-items');

// We pull these dependencies in now, from here, because they have Node.js dependencies

require('./js/logging');

if (window.config.proxyUrl) {
  console.log('using proxy url', window.config.proxyUrl);
}

window.nodeSetImmediate = setImmediate;
window.nodeWebSocket = require('websocket').w3cwebsocket;

// Linux seems to periodically let the event loop stop, so this is a global workaround
setInterval(() => {
  window.nodeSetImmediate(() => {});
}, 1000);

const { autoOrientImage } = require('./js/modules/auto_orient_image');

window.autoOrientImage = autoOrientImage;
window.dataURLToBlobSync = require('blueimp-canvas-to-blob');
window.EmojiConvertor = require('emoji-js');
window.emojiData = require('emoji-datasource');
window.EmojiPanel = require('emoji-panel');
window.libphonenumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
window.libphonenumber.PhoneNumberFormat =
  require('google-libphonenumber').PhoneNumberFormat;
window.loadImage = require('blueimp-load-image');

window.nodeBuffer = Buffer;
window.nodeFetch = require('node-fetch');
window.nodeNotifier = require('node-notifier');
window.ProxyAgent = require('proxy-agent');

// ES2015+ modules
const attachmentsPath = Attachments.getPath(app.getPath('userData'));
const deleteAttachmentData = Attachments.createDeleter(attachmentsPath);
const readAttachmentData = Attachments.createReader(attachmentsPath);
const writeAttachmentData = Attachments.createWriter(attachmentsPath);

// Injected context functions to keep `Message` agnostic from Electron:
const upgradeSchemaContext = {
  writeAttachmentData,
};
const upgradeMessageSchema = message =>
  Message.upgradeSchema(message, upgradeSchemaContext);

const { getPlaceholderMigrations } =
  require('./js/modules/migrations/get_placeholder_migrations');
const { IdleDetector } = require('./js/modules/idle_detector');

window.Signal = {};
window.Signal.Backup = require('./js/modules/backup');
window.Signal.Crypto = require('./js/modules/crypto');
window.Signal.Database = require('./js/modules/database');
window.Signal.Debug = require('./js/modules/debug');
window.Signal.Logs = require('./js/modules/logs');

window.Signal.Migrations = {};
window.Signal.Migrations.deleteAttachmentData =
  Attachment.deleteData(deleteAttachmentData);
window.Signal.Migrations.getPlaceholderMigrations = getPlaceholderMigrations;
window.Signal.Migrations.loadAttachmentData = Attachment.loadData(readAttachmentData);
window.Signal.Migrations.Migrations0DatabaseWithAttachmentData =
  require('./js/modules/migrations/migrations_0_database_with_attachment_data');
window.Signal.Migrations.Migrations1DatabaseWithoutAttachmentData =
  require('./js/modules/migrations/migrations_1_database_without_attachment_data');

window.Signal.Migrations.upgradeMessageSchema = upgradeMessageSchema;
window.Signal.OS = require('./js/modules/os');
window.Signal.Settings = require('./js/modules/settings');

window.Signal.Types = {};
window.Signal.Types.Attachment = Attachment;
window.Signal.Types.Errors = require('./js/modules/types/errors');

window.Signal.Types.Message = Message;
window.Signal.Types.MIME = require('./js/modules/types/mime');
window.Signal.Types.Settings = require('./js/modules/types/settings');

window.Signal.Views = {};
window.Signal.Views.Initialization = require('./js/modules/views/initialization');

window.Signal.Workflow = {};
window.Signal.Workflow.IdleDetector = IdleDetector;
window.Signal.Workflow.MessageDataMigrator =
  require('./js/modules/messages_data_migrator');

// We pull this in last, because the native module involved appears to be sensitive to
//   /tmp mounted as noexec on Linux.
require('./js/spell_check');
