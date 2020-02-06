/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.React = require('react');
window.ReactDOM = require('react-dom');

window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

// So far we're only using this for Signal.Types
const Signal = require('./js/modules/signal');
const electron = require('electron');

const ipc = electron.ipcRenderer;

window.Signal = Signal.setup({
  Attachments: null,
  userDataPath: null,
  getRegionCode: () => null,
});

window.Signal.Logs = require('./js/modules/logs');

window.CONSTANTS = {
  MAX_LOGIN_TRIES: 3,
  MAX_PASSWORD_LENGTH: 32,
  MAX_USERNAME_LENGTH: 20,
};

window.passwordUtil = require('./app/password_util');
window.Signal.Logs = require('./js/modules/logs');

window.resetDatabase = () => {
  window.log.info('reset database');
  ipcRenderer.send('resetDatabase');
};

window.restart = () => {
  window.log.info('restart');
  ipc.send('restart');
};

window.clearLocalData = async () => {
  window.resetDatabase();
  window.restart();
};

window.onLogin = passPhrase =>
  new Promise((resolve, reject) => {
    ipcRenderer.once('password-window-login-response', (event, error) => {
      if (error) {
        return reject(error);
      }
      return resolve();
    });
    ipcRenderer.send('password-window-login', passPhrase);
  });

require('./js/logging');
