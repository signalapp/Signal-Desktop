const path = require('path');
const process = require('process');

const { app } = require('electron');

const { start } = require('./base_config');
const config = require('./config');

let storageProfile;
const { NODE_ENV: environment, NODE_APP_INSTANCE:instance } = process.env;
const isProduction = environment === 'production' && !instance;

// Use seperate data directories for each different environment and app instances
// We should prioritise config values first
if (config.has(storageProfile)) {
  storageProfile = config.get('storageProfile');
} else if (!isProduction) {
  storageProfile = environment;
  if (instance) {
    storageProfile = storageProfile.concat(`-${instance}`)
  }
}

if (storageProfile) {
  const userData = path.join(
    app.getPath('appData'),
    `Session-${storageProfile}`
  );

  app.setPath('userData', userData);
}

console.log(`userData: ${app.getPath('userData')}`);

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'config.json');

const userConfig = start('user', targetPath);

module.exports = userConfig;
