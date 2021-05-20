// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

const React = require('react');
const ReactDOM = require('react-dom');
const url = require('url');
const { ipcRenderer } = require('electron');

const i18n = require('./js/modules/i18n');
const {
  getEnvironment,
  setEnvironment,
  parseEnvironment,
} = require('./ts/environment');
const {
  CallingScreenSharingController,
} = require('./ts/components/CallingScreenSharingController');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
setEnvironment(parseEnvironment(config.environment));

window.React = React;
window.ReactDOM = ReactDOM;
window.getAppInstance = () => config.appInstance;
window.getEnvironment = getEnvironment;
window.getVersion = () => config.version;
window.i18n = i18n.setup(locale, localeMessages);

let renderComponent;
window.registerScreenShareControllerRenderer = f => {
  renderComponent = f;
};

function renderScreenSharingController(event, presentedSourceName) {
  if (!renderComponent) {
    setTimeout(renderScreenSharingController, 100);
    return;
  }

  const props = {
    i18n: window.i18n,
    onCloseController: () => ipcRenderer.send('close-screen-share-controller'),
    onStopSharing: () => ipcRenderer.send('stop-screen-share'),
    presentedSourceName,
  };

  renderComponent(CallingScreenSharingController, props);
}

ipcRenderer.once(
  'render-screen-sharing-controller',
  renderScreenSharingController
);

require('./ts/logging/set_up_renderer_logging').initialize();
