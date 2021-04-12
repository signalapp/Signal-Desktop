// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');
const {
  getEnvironment,
  setEnvironment,
  parseEnvironment,
} = require('./ts/environment');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
setEnvironment(parseEnvironment(config.environment));

window.getEnvironment = getEnvironment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

window.closeAbout = () => ipcRenderer.send('close-about');

window.i18n = i18n.setup(locale, localeMessages);

require('./ts/logging/set_up_renderer_logging').initialize();
