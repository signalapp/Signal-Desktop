/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);

// So far we're only using this for Signal.Types
const Signal = require('./js/modules/signal');

window.Signal = Signal.setup({
  Attachments: null,
  userDataPath: null,
  getRegionCode: () => null,
});

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

window.onLogin = (passPhrase) => new Promise((resolve, reject) => {
  ipcRenderer.once('password-window-login-response', (event, error) => {
    if (error) {
      return reject(error);
    }
    return resolve();
  });
  ipcRenderer.send('password-window-login', passPhrase);
});

require('./js/logging');
