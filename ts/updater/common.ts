import { BrowserWindow, dialog } from 'electron';

export type MessagesType = {
  [key: string]: string;
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
    type: 'info' as const,
    buttons: [messages.autoUpdateDownloadButtonLabel, messages.autoUpdateLaterButtonLabel],
    title: messages.autoUpdateNewVersionTitle,
    message: messages.autoUpdateNewVersionMessage,
    detail: messages.autoUpdateDownloadInstructions,
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
    type: 'info' as const,
    buttons: [messages.autoUpdateRestartButtonLabel, messages.autoUpdateLaterButtonLabel],
    title: messages.autoUpdateNewVersionTitle,
    message: messages.autoUpdateDownloadedMessage,
    detail: messages.autoUpdateNewVersionInstructions,
    defaultId: LATER_BUTTON,
    cancelId: RESTART_BUTTON,
  };
  const ret = await dialog.showMessageBox(mainWindow, options);

  return ret.response === RESTART_BUTTON;
}

export async function showCannotUpdateDialog(mainWindow: BrowserWindow, messages: MessagesType) {
  const options = {
    type: 'error' as const,
    buttons: [messages.ok],
    title: messages.cannotUpdate,
    message: messages.cannotUpdateDetail,
  };
  await dialog.showMessageBox(mainWindow, options);
}

export function getPrintableError(error: Error) {
  return error && error.stack ? error.stack : error;
}
