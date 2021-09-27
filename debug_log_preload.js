// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');

// It is important to call this as early as possible
require('./ts/windows/context');

const { setupI18n } = require('./ts/util/setupI18n');
const { createSetting } = require('./ts/util/preload');
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
window.themeSetting = createSetting('themeSetting', { setter: false });
window.i18n = setupI18n(locale, localeMessages);

// got.js appears to need this to successfully submit debug logs to the cloud
window.nodeSetImmediate = setImmediate;

window.getNodeVersion = () => config.node_version;
window.getEnvironment = getEnvironment;

window.Backbone = require('backbone');
require('./ts/backbone/views/whisper_view');
require('./ts/logging/set_up_renderer_logging').initialize();
require('./ts/views/debug_log_view');

window.closeDebugLog = () => ipcRenderer.send('close-debug-log');
window.Backbone = require('backbone');
