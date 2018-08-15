/* global Whisper: false */

const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

const config = require('./config');
const windowState = require('./window_state');

const hour = 60 * 60;
const autoUpdaterInterval = hour * 1000;

const RESTART_BUTTON = 0;
const LATER_BUTTON = 1;

function autoUpdateDisabled() {
  return (
    process.platform === 'linux' ||
    process.mas ||
    config.get('disableAutoUpdate')
  );
}

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

function updateApp() {
  setTimeout(() => {
    windowState.markShouldQuit();
    autoUpdater.quitAndInstall();
  }, 200);
}

function onError(error) {
  console.log('Got an error while updating: ', error.stack);
}

function initialize(getMainWindow, messages) {
  if (!messages) {
    throw new Error('auto-update initialize needs localized messages');
  }

  // Uncomment for testing
  // setInterval(() => {
  //  getMainWindow().webContents.send('updateNeeded');
  // }, 5000);

  if (autoUpdateDisabled()) {
    return;
  }

  autoUpdater.addListener('update-downloaded', () => {
    getMainWindow().webContents.send('updateNeeded');
  });
  autoUpdater.addListener('error', onError);

  checkForUpdates();

  setInterval(checkForUpdates, autoUpdaterInterval);
}

module.exports = {
  initialize,
  updateApp,
};
