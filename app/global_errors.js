const electron = require('electron');

const Errors = require('../js/modules/types/errors');

const { app, dialog, clipboard } = electron;

// We're using hard-coded strings in this file because it needs to be ready
//   to report errors before we do anything in the app. Also, we expect users to directly
//   paste this text into search engines to find the bugs on GitHub.

function handleError(prefix, error) {
  console.error(`${prefix}:`, Errors.toLogFormat(error));

  if (app.isReady()) {
    // title field is not shown on macOS, so we don't use it
    const buttonIndex = dialog.showMessageBox({
      buttons: ['OK', 'Copy error'],
      defaultId: 0,
      detail: error.stack,
      message: prefix,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 1) {
      clipboard.writeText(`${prefix}\n${error.stack}`);
    }
  } else {
    dialog.showErrorBox(prefix, error.stack);
  }

  app.quit();
}

exports.addHandler = () => {
  process.on('uncaughtException', error => {
    handleError('Unhandled Error', error);
  });

  process.on('unhandledRejection', error => {
    handleError('Unhandled Promise Rejection', error);
  });
};
