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

  const ret = await dialog.showMessageBox(mainWindow, options);

  return ret.response === DOWNLOAD_BUTTON;
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
  const ret = await dialog.showMessageBox(mainWindow, options);

  return ret.response === RESTART_BUTTON;
}

export async function showCannotUpdateDialog(
  mainWindow: BrowserWindow,
  messages: MessagesType
) {
  const options = {
    type: 'error',
    buttons: [messages.ok.message],
    title: messages.cannotUpdate.message,
    message: messages.cannotUpdateDetail.message,
  };
  await dialog.showMessageBox(mainWindow, options);
}

export function getPrintableError(error: Error) {
  return error && error.stack ? error.stack : error;
}
