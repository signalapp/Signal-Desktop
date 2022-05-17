import { app, clipboard, dialog } from 'electron';
import { redactAll } from '../util/privacy'; // checked - only node
import { LocaleMessagesType } from './locale'; // checked - only node
import { ConsoleCustom } from './logging'; // checked - only node
// tslint:disable: no-console

// We use hard-coded strings until we're able to update these strings from the locale.
let quitText = 'Quit';
let copyErrorAndQuitText = 'Copy error and quit';

async function handleError(prefix: string, error: any) {
  if ((console as ConsoleCustom)._error) {
    (console as ConsoleCustom)._error(`${prefix}:`, error);
  }
  console.error(`${prefix}:`, error);

  if (app.isReady()) {
    // title field is not shown on macOS, so we don't use it
    const button = await dialog.showMessageBox({
      buttons: [quitText, copyErrorAndQuitText],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: prefix,
      noLink: true,
      type: 'error',
    });
    if (button.response === 1) {
      clipboard.writeText(`${prefix}\n\n${redactAll(error.stack)}`);
    }
  } else {
    dialog.showErrorBox(prefix, error.stack);
  }

  app.exit(1);
}

export const updateLocale = (messages: LocaleMessagesType) => {
  quitText = messages.quit;
  copyErrorAndQuitText = messages.copyErrorAndQuit;
};

export const setupGlobalErrorHandler = () => {
  process.on('uncaughtException', async error => {
    await handleError('Unhandled Error', error);
  });

  process.on('unhandledRejection', async error => {
    await handleError('Unhandled Promise Rejection', error);
  });
};
