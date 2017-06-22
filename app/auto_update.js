const autoUpdater = require('electron-updater').autoUpdater
const { dialog } = require('electron');

const config = require('./config');
const locale = require('./locale');
const windowState = require('./window_state');

const hour = 60 * 60;
const autoUpdaterInterval = hour * 1000;

const RESTART_BUTTON = 0;
const LATER_BUTTON = 1;

function autoUpdateDisabled() {
  return process.mas || config.get('disableAutoUpdate');
}

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

function showUpdateDialog() {
  const options = {
    type: 'info',
    buttons: [
      locale.messages.autoUpdateRestartButtonLabel.message,
      locale.messages.autoUpdateLaterButtonLabel.message
    ],
    title: locale.messages.autoUpdateNewVersionTitle.message,
    message: locale.messages.autoUpdateNewVersionMessage.message,
    detail: locale.messages.autoUpdateNewVersionInstructions.message,
    defaultId: RESTART_BUTTON,
    cancelId: LATER_BUTTON
  }

  dialog.showMessageBox(options, function(response) {
    if (response == RESTART_BUTTON) {
      windowState.markShouldQuit();
      autoUpdater.quitAndInstall();
    }
  });
}

function onError(error) {
  console.log("Got an error while updating: ", error.stack);
}

function initialize() {
  if (autoUpdateDisabled()) {
    return;
  }

  autoUpdater.addListener('update-downloaded', showUpdateDialog);
  autoUpdater.addListener('error', onError);

  checkForUpdates();

  setInterval(checkForUpdates, autoUpdaterInterval);
}

module.exports = {
  initialize
};
