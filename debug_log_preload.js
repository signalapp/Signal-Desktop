// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const copyText = require('copy-text-to-clipboard');
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

window.getVersion = () => config.version;
window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);
window.copyText = copyText;

// got.js appears to need this to successfully submit debug logs to the cloud
window.nodeSetImmediate = setImmediate;

window.getNodeVersion = () => config.node_version;
window.getEnvironment = getEnvironment;

window.Backbone = require('backbone');
require('./ts/backbone/views/whisper_view');
require('./ts/backbone/views/toast_view');
require('./ts/logging/set_up_renderer_logging').initialize();

window.closeDebugLog = () => ipcRenderer.send('close-debug-log');
window.Backbone = require('backbone');
