// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { app } = require('electron');

const dockIcon = {};

dockIcon.show = () => {
  if (process.platform === 'darwin') {
    app.dock.show();
  }
};

dockIcon.hide = () => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
};

module.exports = dockIcon;
