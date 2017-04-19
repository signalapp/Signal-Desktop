(function () {
  'use strict';
  console.log('preload');
  const electron = require('electron')

  window.config = require('url').parse(window.location.toString(), true).query;

  const ipc = electron.ipcRenderer
  window.config.locale_json = ipc.sendSync('locale-data');

})();
