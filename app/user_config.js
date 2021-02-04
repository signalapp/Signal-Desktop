// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const path = require('path');

const { app } = require('electron');

const { start } = require('./base_config');
const config = require('./config');

// Use separate data directory for development
if (config.has('storageProfile')) {
  const userData = path.join(
    app.getPath('appData'),
    `Signal-${config.get('storageProfile')}`
  );

  app.setPath('userData', userData);
}

console.log(`userData: ${app.getPath('userData')}`);

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'config.json');

const userConfig = start('user', targetPath);

module.exports = userConfig;
