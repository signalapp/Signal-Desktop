/* global window */
/* eslint-disable @typescript-eslint/no-var-requires */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./ts/util/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.React = require('react');
window.ReactDOM = require('react-dom');

// If the app is locked we can't access the database to check the theme.
window.theme = 'classic-dark';
window.primaryColor = 'green';
window.i18n = i18n.setupi18n(locale, localeMessages);

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

window.clearLocalData = async () => {
  window.log.info('reset database');
  ipcRenderer.send('resetDatabase');
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

require('./ts/util/logging');
