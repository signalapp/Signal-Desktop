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

function i18n(key, messages, failover) {
  var string = messages[key];

  if (!string) {
    string = failover[key];
  }

  return string.message;
}

var showingDialog = false;
function showUpdateDialog(messages, failover) {
  if (showingDialog) {
    return;
  }
  showingDialog = true;

  const options = {
    type: 'info',
    buttons: [
      i18n('autoUpdateRestartButtonLabel', messages, failover),
      i18n('autoUpdateLaterButtonLabel', messages, failover),
    ],
    title: i18n('autoUpdateNewVersionTitle', messages, failover),
    message: i18n('autoUpdateNewVersionMessage', messages, failover),
    detail: i18n('autoUpdateNewVersionInstructions', messages, failover),
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

function initialize(messages, failover) {
  if (!messages || !failover) {
    throw new Error('auto-update initialize needs localized messages');
  }

  if (autoUpdateDisabled()) {
    return;
  }

  autoUpdater.addListener('update-downloaded', function() {
    showUpdateDialog(messages, failover);
  });
  autoUpdater.addListener('error', onError);

  checkForUpdates();

  setInterval(checkForUpdates, autoUpdaterInterval);
}

module.exports = {
  initialize
};
