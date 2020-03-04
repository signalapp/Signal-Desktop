const electron = require('electron');

const Errors = require('../js/modules/types/errors');

const { app, dialog, clipboard } = electron;
const { redactAll } = require('../js/modules/privacy');

// We use hard-coded strings until we're able to update these strings from the locale.
let quitText = 'Quit';
let copyErrorAndQuitText = 'Copy error and quit';

function handleError(prefix, error) {
  if (console._error) {
    console._error(`${prefix}:`, Errors.toLogFormat(error));
  }
  console.error(`${prefix}:`, Errors.toLogFormat(error));

  if (app.isReady()) {
    // title field is not shown on macOS, so we don't use it
    const buttonIndex = dialog.showMessageBox({
      buttons: [quitText, copyErrorAndQuitText],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: prefix,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 1) {
      clipboard.writeText(`${prefix}\n\n${redactAll(error.stack)}`);
    }
  } else {
    dialog.showErrorBox(prefix, error.stack);
  }

  app.exit(1);
}

exports.updateLocale = messages => {
  quitText = messages.quit.message;
  copyErrorAndQuitText = messages.copyErrorAndQuit.message;
};

exports.addHandler = () => {
  process.on('uncaughtException', error => {
    handleError('Unhandled Error', error);
  });

  process.on('unhandledRejection', error => {
    handleError('Unhandled Promise Rejection', error);
  });
};
