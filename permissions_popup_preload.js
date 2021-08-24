// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

window.React = require('react');
window.ReactDOM = require('react-dom');

const { ipcRenderer } = require('electron');
const url = require('url');

// It is important to call this as early as possible
require('./ts/windows/context');

const i18n = require('./js/modules/i18n');
const { ConfirmationDialog } = require('./ts/components/ConfirmationDialog');
const {
  getEnvironment,
  setEnvironment,
  parseEnvironment,
} = require('./ts/environment');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
setEnvironment(parseEnvironment(config.environment));

const { createSetting } = require('./ts/util/preload');

window.getEnvironment = getEnvironment;
window.getVersion = () => config.version;
window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);
window.forCalling = config.forCalling === 'true';
window.forCamera = config.forCamera === 'true';
window.Signal = {
  Components: {
    ConfirmationDialog,
  },
};

require('./ts/logging/set_up_renderer_logging').initialize();

window.closePermissionsPopup = () =>
  ipcRenderer.send('close-permissions-popup');

window.Backbone = require('backbone');

window.Settings = {
  mediaCameraPermissions: createSetting('mediaCameraPermissions', {
    getter: false,
  }),
  mediaPermissions: createSetting('mediaPermissions', {
    getter: false,
  }),
  themeSetting: createSetting('themeSetting', { setter: false }),
};
