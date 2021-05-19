/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

global.dcodeIO = global.dcodeIO || {};
global.dcodeIO.ByteBuffer = require('bytebuffer');

window.React = require('react');
window.ReactDOM = require('react-dom');

window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

const electron = require('electron');

const ipc = electron.ipcRenderer;
const { SessionPasswordPrompt } = require('./ts/components/session/SessionPasswordPrompt');

window.Signal = {
  Components: {
    SessionPasswordPrompt,
  },
};

window.Signal.Logs = require('./js/modules/logs');

window.resetDatabase = () => {
  window?.log?.info('reset database');
  ipcRenderer.send('resetDatabase');
};

window.restart = () => {
  window?.log?.info('restart');
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
