// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

window.React = require('react');
window.ReactDOM = require('react-dom');

const { ipcRenderer, remote } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');
const { ConfirmationModal } = require('./ts/components/ConfirmationModal');
const { makeGetter, makeSetter } = require('./preload_utils');
const {
  getEnvironment,
  setEnvironment,
  parseEnvironment,
} = require('./ts/environment');

const { nativeTheme } = remote.require('electron');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
setEnvironment(parseEnvironment(config.environment));

window.getEnvironment = getEnvironment;
window.getVersion = () => config.version;
window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);
window.forCalling = config.forCalling === 'true';
window.forCamera = config.forCamera === 'true';
window.Signal = {
  Components: {
    ConfirmationModal,
  },
};

function setSystemTheme() {
  window.systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

setSystemTheme();

window.subscribeToSystemThemeChange = fn => {
  nativeTheme.on('updated', () => {
    setSystemTheme();
    fn();
  });
};

require('./ts/logging/set_up_renderer_logging').initialize();

window.closePermissionsPopup = () =>
  ipcRenderer.send('close-permissions-popup');

window.setMediaPermissions = makeSetter('media-permissions');
window.setMediaCameraPermissions = makeSetter('media-camera-permissions');
window.getThemeSetting = makeGetter('theme-setting');
window.setThemeSetting = makeSetter('theme-setting');
window.Backbone = require('backbone');
