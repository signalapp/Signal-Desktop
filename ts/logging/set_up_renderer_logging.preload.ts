// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-env node */

import { ipcRenderer as ipc } from 'electron';
import * as path from 'node:path';

import {
  initLogger,
  LogLevel as SignalClientLogLevel,
} from '@signalapp/libsignal-client';

import { setPinoDestination, log } from './log.std.js';
import * as Errors from '../types/errors.std.js';
import { createRotatingPinoDest } from '../util/rotatingPinoDest.node.js';
import { redactAll } from '../util/privacy.node.js';

let isInitialized = false;
let shouldRestart = false;

export function beforeRestart(): void {
  shouldRestart = true;
}

export function initialize(): void {
  if (isInitialized) {
    throw new Error('Already initialized');
  }
  isInitialized = true;

  const basePath = ipc.sendSync('get-user-data-path');
  const logFile = path.join(basePath, 'logs', 'app.log');

  const onClose = () => {
    if (shouldRestart) {
      initialize();
    }
  };

  const stream = createRotatingPinoDest({
    logFile,
  });

  stream.on('close', onClose);
  stream.on('error', onClose);

  setPinoDestination(stream, redactAll);
}

window.onerror = (message, source, line, column, error) => {
  const errorInfo = Errors.toLogFormat(error);
  log.error(
    `Top-level unhandled error: ${message}, ${errorInfo}`,
    Errors.toLocation(source, line, column)
  );
};

window.addEventListener('unhandledrejection', rejectionEvent => {
  const error = rejectionEvent.reason;
  const errorString = Errors.toLogFormat(error);
  log.error(`Top-level unhandled promise rejection: ${errorString}`);
});

const libSignalLog = log.child('@signalapp/libsignal-client');

initLogger(
  SignalClientLogLevel.Info,
  (
    level: unknown,
    target: string,
    file: string | null,
    line: number | null,
    message: string
  ) => {
    let fileString = '';
    if (file && line) {
      fileString = ` ${file}:${line}`;
    } else if (file) {
      fileString = ` ${file}`;
    }
    const logString = `${message} ${target}${fileString}`;

    if (level === SignalClientLogLevel.Trace) {
      libSignalLog.trace(logString);
    } else if (level === SignalClientLogLevel.Debug) {
      libSignalLog.debug(logString);
    } else if (level === SignalClientLogLevel.Info) {
      libSignalLog.info(logString);
    } else if (level === SignalClientLogLevel.Warn) {
      libSignalLog.warn(logString);
    } else if (level === SignalClientLogLevel.Error) {
      libSignalLog.error(logString);
    } else {
      libSignalLog.error(`${logString} (unknown log level ${level})`);
    }
  }
);
