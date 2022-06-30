// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app, dialog, clipboard } from 'electron';

import * as Errors from '../ts/types/errors';
import { redactAll } from '../ts/util/privacy';
import type { LocaleMessagesType } from '../ts/types/I18N';
import { reallyJsonStringify } from '../ts/util/reallyJsonStringify';

// We use hard-coded strings until we're able to update these strings from the locale.
let quitText = 'Quit';
let copyErrorAndQuitText = 'Copy error and quit';

function handleError(prefix: string, error: Error): void {
  if (console._error) {
    console._error(`${prefix}:`, Errors.toLogFormat(error));
  }
  console.error(`${prefix}:`, Errors.toLogFormat(error));

  if (app.isReady()) {
    // title field is not shown on macOS, so we don't use it
    const buttonIndex = dialog.showMessageBoxSync({
      buttons: [quitText, copyErrorAndQuitText],
      defaultId: 0,
      detail: redactAll(error.stack || ''),
      message: prefix,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 1) {
      clipboard.writeText(`${prefix}\n\n${redactAll(error.stack || '')}`);
    }
  } else {
    dialog.showErrorBox(prefix, error.stack || '');
  }

  app.exit(1);
}

export const updateLocale = (messages: LocaleMessagesType): void => {
  quitText = messages.quit.message;
  copyErrorAndQuitText = messages.copyErrorAndQuit.message;
};

function _getError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }

  const errorString = reallyJsonStringify(reason);
  return new Error(`Promise rejected with a non-error: ${errorString}`);
}

export const addHandler = (): void => {
  app.on('render-process-gone', (_event, _webContents, details) => {
    const { reason, exitCode } = details;

    if (reason === 'clean-exit') {
      return;
    }

    handleError(
      'Render process is gone',
      new Error(`Reason: ${reason}, Exit Code: ${exitCode}`)
    );
  });

  process.on('uncaughtException', (reason: unknown) => {
    handleError('Unhandled Error', _getError(reason));
  });

  process.on('unhandledRejection', (reason: unknown) => {
    handleError('Unhandled Promise Rejection', _getError(reason));
  });
};
