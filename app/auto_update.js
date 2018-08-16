const { autoUpdater } = require('electron-updater');

const config = require('./config');
const windowState = require('./window_state');

const hour = 60 * 60;
const autoUpdaterInterval = hour * 1000;

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
  //   const win = getMainWindow();
  //   if (win !== null) {
  //     win.webContents.send('updateNeeded');
  //   }
  // }, 5000);

  if (autoUpdateDisabled()) {
    return;
  }

  autoUpdater.addListener('update-downloaded', () => {
    const win = getMainWindow();
    if (win !== null) {
      win.webContents.send('updateNeeded');
    }
  });
  autoUpdater.addListener('error', onError);

  checkForUpdates();

  setInterval(checkForUpdates, autoUpdaterInterval);
}

module.exports = {
  initialize,
  updateApp,
};
