/* eslint-disable @typescript-eslint/no-var-requires */
/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./ts/util/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.React = require('react');
window.ReactDOM = require('react-dom');

window.theme = config.theme;
window.i18n = i18n.setupi18n(locale, localeMessages);

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getCommitHash = () => config.commitHash;
window.getAppInstance = () => config.appInstance;

const { AboutView } = require('./ts/components/AboutView');

window.Signal = {
  Components: {
    AboutView,
  },
};

window.closeAbout = () => ipcRenderer.send('close-about');

require('./ts/util/logging');
