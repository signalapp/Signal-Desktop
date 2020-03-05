import { BrowserWindow, dialog } from 'electron';

export type MessagesType = {
  [key: string]: {
    message: string;
    description?: string;
  };
};

type LogFunction = (...args: Array<any>) => void;

export type LoggerType = {
  fatal: LogFunction;
  error: LogFunction;
  warn: LogFunction;
  info: LogFunction;
  debug: LogFunction;
  trace: LogFunction;
};

export async function showDownloadUpdateDialog(
  mainWindow: BrowserWindow,
  messages: MessagesType
): Promise<boolean> {
  const DOWNLOAD_BUTTON = 0;
  const LATER_BUTTON = 1;
  const options = {
    type: 'info',
    buttons: [
      messages.autoUpdateDownloadButtonLabel.message,
      messages.autoUpdateLaterButtonLabel.message,
    ],
    title: messages.autoUpdateNewVersionTitle.message,
    message: messages.autoUpdateNewVersionMessage.message,
    detail: messages.autoUpdateDownloadInstructions.message,
    defaultId: LATER_BUTTON,
    cancelId: DOWNLOAD_BUTTON,
  };

  return new Promise(resolve => {
    dialog.showMessageBox(mainWindow, options, response => {
      resolve(response === DOWNLOAD_BUTTON);
    });
  });
}

export async function showUpdateDialog(
  mainWindow: BrowserWindow,
  messages: MessagesType
): Promise<boolean> {
  const RESTART_BUTTON = 0;
  const LATER_BUTTON = 1;
  const options = {
    type: 'info',
    buttons: [
      messages.autoUpdateRestartButtonLabel.message,
      messages.autoUpdateLaterButtonLabel.message,
    ],
    title: messages.autoUpdateNewVersionTitle.message,
    message: messages.autoUpdateDownloadedMessage.message,
    detail: messages.autoUpdateNewVersionInstructions.message,
    defaultId: LATER_BUTTON,
    cancelId: RESTART_BUTTON,
  };

  return new Promise(resolve => {
    dialog.showMessageBox(mainWindow, options, response => {
      // It's key to delay any install calls here because they don't seem to work inside this
      //   callback - but only if the message box has a parent window.
      // Fixes this: https://github.com/signalapp/Signal-Desktop/issues/1864
      resolve(response === RESTART_BUTTON);
    });
  });
}

export async function showCannotUpdateDialog(
  mainWindow: BrowserWindow,
  messages: MessagesType
): Promise<boolean> {
  const options = {
    type: 'error',
    buttons: [messages.ok.message],
    title: messages.cannotUpdate.message,
    message: messages.cannotUpdateDetail.message,
  };

  return new Promise(resolve => {
    dialog.showMessageBox(mainWindow, options, () => {
      resolve();
    });
  });
}

export function getPrintableError(error: Error) {
  return error && error.stack ? error.stack : error;
}
