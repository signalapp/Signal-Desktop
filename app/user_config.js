const path = require('path');

const { app } = require('electron');
const ElectronConfig = require('electron-config');

const config = require('./config');


// use a separate data directory for development
if (config.has('storageProfile')) {
  const userData = path.join(
    app.getPath('appData'),
    `Signal-${config.get('storageProfile')}`
  );

  app.setPath('userData', userData);
}

console.log(`userData: ${app.getPath('userData')}`);

// this needs to be below our update to the appData path
const userConfig = new ElectronConfig();

module.exports = userConfig;
