/*
 * Pending electron 1.6.x
 * const env = require('url').parse(window.location, true).query;
*/

window.env = {};
window.location.search.substring(1).split('&').forEach(function(variable) {
  var pair = variable.split('=');
  env[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
});

const ipc = require('electron').ipcRenderer
window.env.locale_json = ipc.sendSync('locale-data');
