(function () {
  'use strict';

  window.version = require('./package.json').version;
  window.hostname = require('os').hostname();

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
  window.restart = function() {
    console.log('restart');
    ipc.send('restart');
  };
  ipc.on('debug-log', function() {
    Whisper.events.trigger('showDebugLog');
  });

  // We pull these dependencies in now, from here, because they have Node.js dependencies

  require('./js/logging');
  require('./js/spell_check');
  require('./js/backup');

  window.nodeSetImmediate = setImmediate;
  window.nodeXMLHttpRequest = require("./js/XMLHttpRequest").XMLHttpRequest;
  window.nodeWebSocket = require("websocket").w3cwebsocket;

  // Linux seems to periodically let the event loop stop, so this is a global workaround
  setInterval(function() {
    window.nodeSetImmediate(function() {});
  }, 1000);

  window.EmojiConvertor = require('emoji-js');
})();
