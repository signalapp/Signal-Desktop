const autoUpdater = require('electron-updater').autoUpdater
const { dialog } = require('electron');

const windowState = require('./window_state');

const hour = 60 * 60;
const autoUpdaterInterval = hour * 1000;

const RESTART_BUTTON = 0;
const LATER_BUTTON = 1;

function autoUpdateDisabled(config) {
  return process.mas || config.get('disableAutoUpdate');
}

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

function showUpdateDialog(localeMessages) {
  return function() {
    const options = {
      type: 'info',
      buttons: [
        localeMessages.autoUpdateRestartButtonLabel.message,
        localeMessages.autoUpdateLaterButtonLabel.message
      ],
      title: localeMessages.autoUpdateNewVersionTitle.message,
      message: localeMessages.autoUpdateNewVersionMessage.message,
      detail: localeMessages.autoUpdateNewVersionInstructions.message,
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
}

function onError(error) {
  console.log("Got an error while updating: ", error.stack);
}

function initializeAutoUpdater(config, localeMessages) {
  if (autoUpdateDisabled(config)) {
    return;
  }

  const onUpdateDownloaded = showUpdateDialog(localeMessages);

  autoUpdater.addListener('update-downloaded', onUpdateDownloaded);
  autoUpdater.addListener('error', onError);

  checkForUpdates();

  setInterval(checkForUpdates, autoUpdaterInterval);
}

module.exports = {
  initializeAutoUpdater
};
