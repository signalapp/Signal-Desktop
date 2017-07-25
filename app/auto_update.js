const autoUpdater = require('electron-updater').autoUpdater
const { dialog } = require('electron');

const config = require('./config');
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

var showingDialog = false;
function showUpdateDialog(messages) {
  if (showingDialog) {
    return;
  }
  showingDialog = true;

  const options = {
    type: 'info',
    buttons: [
      messages.autoUpdateRestartButtonLabel.message,
      messages.autoUpdateLaterButtonLabel.message
    ],
    title: messages.autoUpdateNewVersionTitle.message,
    message: messages.autoUpdateNewVersionMessage.message,
    detail: messages.autoUpdateNewVersionInstructions.message,
    defaultId: RESTART_BUTTON,
    cancelId: LATER_BUTTON
  }

  dialog.showMessageBox(options, function(response) {
    if (response == RESTART_BUTTON) {
      windowState.markShouldQuit();
      autoUpdater.quitAndInstall();
    }

    showingDialog = false;
  });
}

function onError(error) {
  console.log("Got an error while updating: ", error.stack);
}

function initialize(messages) {
  if (!messages) {
    throw new Error('auto-update initialize needs localized messages');
  }

  if (autoUpdateDisabled()) {
    return;
  }

  autoUpdater.addListener('update-downloaded', function() {
    showUpdateDialog(messages);
  });
  autoUpdater.addListener('error', onError);

  checkForUpdates();

  setInterval(checkForUpdates, autoUpdaterInterval);
}

module.exports = {
  initialize
};
