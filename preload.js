(function () {
  'use strict';

  console.log('preload');
  const electron = require('electron');

  window.PROTO_ROOT = 'protos';
  window.config = require('url').parse(window.location.toString(), true).query;

  const ipc = electron.ipcRenderer;
  window.config.localeMessages = ipc.sendSync('locale-data');

  window.setBadgeCount = function(count) {
    ipc.send('set-badge-count', count);
  };
  window.drawAttention = function() {
    console.log('draw attention');
    ipc.send('draw-attention');
  };
  window.showWindow = function() {
    console.log('show window');
    ipc.send('show-window');
  };
  window.setAutoHideMenuBar = function(autoHide) {
    ipc.send('set-auto-hide-menu-bar', autoHide);
  };
  window.setMenuBarVisibility = function(visibility) {
    ipc.send('set-menu-bar-visibility', visibility);
  };
  window.restart = function() {
    console.log('restart');
    ipc.send('restart');
  };
  window.closeAbout = function() {
    ipc.send('close-about');
  };
  window.updateTrayIcon = function(unreadCount) {
    ipc.send('update-tray-icon', unreadCount);
  };

  ipc.on('debug-log', function() {
    Whisper.events.trigger('showDebugLog');
  });

  ipc.on('set-up-with-import', function() {
    Whisper.events.trigger('setupWithImport');
  });

  ipc.on('set-up-as-new-device', function() {
    Whisper.events.trigger('setupAsNewDevice');
  });

  ipc.on('set-up-as-standalone', function() {
    Whisper.events.trigger('setupAsStandalone');
  });

  ipc.on('show-settings', function() {
    Whisper.events.trigger('showSettings');
  });

  window.addSetupMenuItems = function() {
    ipc.send('add-setup-menu-items');
  }

  window.removeSetupMenuItems = function() {
    ipc.send('remove-setup-menu-items');
  }

  // We pull these dependencies in now, from here, because they have Node.js dependencies

  require('./js/logging');

  if (window.config.proxyUrl) {
    console.log('using proxy url', window.config.proxyUrl);
  }

  require('./js/backup');

  window.nodeSetImmediate = setImmediate;
  window.nodeWebSocket = require("websocket").w3cwebsocket;

  // Linux seems to periodically let the event loop stop, so this is a global workaround
  setInterval(function() {
    window.nodeSetImmediate(function() {});
  }, 1000);

  window.dataURLToBlobSync = require('blueimp-canvas-to-blob');
  window.loadImage = require('blueimp-load-image');
  window.ProxyAgent = require('proxy-agent');
  window.EmojiConvertor = require('emoji-js');
  window.emojiData = require('emoji-datasource');
  window.nodeFetch = require('node-fetch');
  window.nodeBuffer = Buffer;
  window.EmojiPanel = require('emoji-panel');
  window.libphonenumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
  window.libphonenumber.PhoneNumberFormat = require('google-libphonenumber').PhoneNumberFormat;
  window.nodeNotifier = require('node-notifier');

  const { autoOrientImage } = require('./js/modules/auto_orient_image');
  window.autoOrientImage = autoOrientImage;

  // ES2015+ modules
  window.Signal = window.Signal || {};
  window.Signal.Types = window.Signal.Types || {};
  window.Signal.Types.Attachment = require('./js/modules/types/attachment');
  window.Signal.Types.Message = require('./js/modules/types/message');
  window.Signal.Types.MIME = require('./js/modules/types/mime');

  // We pull this in last, because the native module involved appears to be sensitive to
  //   /tmp mounted as noexec on Linux.
  require('./js/spell_check');
})();
