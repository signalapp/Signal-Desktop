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

let showingDialog = false;
function showUpdateDialog(mainWindow, messages) {
  if (showingDialog) {
    return;
  }
  showingDialog = true;

  const options = {
    type: 'info',
    buttons: [
      messages.autoUpdateRestartButtonLabel.message,
      messages.autoUpdateLaterButtonLabel.message,
    ],
    title: messages.autoUpdateNewVersionTitle.message,
    message: messages.autoUpdateNewVersionMessage.message,
    detail: messages.autoUpdateNewVersionInstructions.message,
    defaultId: LATER_BUTTON,
    cancelId: RESTART_BUTTON,
  };

  dialog.showMessageBox(mainWindow, options, response => {
    if (response === RESTART_BUTTON) {
      // We delay these update calls because they don't seem to work in this
      //   callback - but only if the message box has a parent window.
      // Fixes this bug: https://github.com/signalapp/Signal-Desktop/issues/1864
      setTimeout(() => {
        windowState.markShouldQuit();
        autoUpdater.quitAndInstall();
      }, 200);
    }

    showingDialog = false;
  });
}

function onError(error) {
  console.log('Got an error while updating: ', error.stack);
}

function initialize(getMainWindow, messages) {
  if (!messages) {
    throw new Error('auto-update initialize needs localized messages');
  }

  if (autoUpdateDisabled()) {
    return;
  }

  autoUpdater.addListener('update-downloaded', () => {
    showUpdateDialog(getMainWindow(), messages);
  });
  autoUpdater.addListener('error', onError);

  checkForUpdates();

  setInterval(checkForUpdates, autoUpdaterInterval);
}

module.exports = {
  initialize,
};
