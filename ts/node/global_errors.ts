import { app, clipboard, dialog } from 'electron';
import { redactAll } from '../util/privacy'; // checked - only node
import { LocaleMessagesType } from './locale'; // checked - only node
import { ConsoleCustom } from './logging'; // checked - only node

// We use hard-coded strings until we're able to update these strings from the locale.
let quitText = 'Quit';
let copyErrorAndQuitText = 'Copy error to clipboard';

async function handleError(prefix: string, error: any) {
  if ((console as ConsoleCustom)._error) {
    (console as ConsoleCustom)._error(`${prefix}:`, error);
  }
  console.error(`${prefix}:`, error);

  if (app.isReady()) {
    // title field is not shown on macOS, so we don't use it
    const button = await dialog.showMessageBox({
      buttons: [copyErrorAndQuitText, quitText],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: prefix,
      noLink: true,
      type: 'error',
    });
    if (button.response === 0) {
      clipboard.writeText(`${prefix}\n\n${redactAll(error.stack)}`);
    } else if (button.response === 1) {
      app.exit(1);
    }
  } else {
    dialog.showErrorBox(prefix, error.stack);
  }
}

export const updateLocale = (messages: LocaleMessagesType) => {
  quitText = messages.quit;
  copyErrorAndQuitText = messages.copyErrorAndQuit;
};

export const setupGlobalErrorHandler = () => {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('uncaughtException', async error => {
    await handleError('Unhandled Error', error);
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('unhandledRejection', async error => {
    await handleError('Unhandled Promise Rejection', error);
  });
};
