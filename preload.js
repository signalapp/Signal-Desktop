/*
 * Pending electron 1.6.x
 * const env = require('url').parse(window.location, true).query;
*/

console.log('preload');

window.config = {};
window.location.search.substring(1).split('&').forEach(function(variable) {
  var pair = variable.split('=');
  config[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
});

const ipc = require('electron').ipcRenderer
window.config.locale_json = ipc.sendSync('locale-data');
