// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-env node */

/* eslint-disable no-console */

import { ipcRenderer as ipc } from 'electron';
import * as path from 'path';
import pino from 'pino';

import {
  initLogger,
  LogLevel as SignalClientLogLevel,
} from '@signalapp/libsignal-client';

import {
  LogLevel,
  cleanArgs,
  getLogLevelString,
  levelMaxLength,
} from './shared';
import * as log from './log';
import { Environment, getEnvironment } from '../environment';
import * as Errors from '../types/errors';
import { createRotatingPinoDest } from '../util/rotatingPinoDest';

// Backwards-compatible logging, simple strings and no level (defaulted to INFO)
function now() {
  const date = new Date();
  return date.toJSON();
}

function consoleLog(...args: ReadonlyArray<unknown>) {
  logAtLevel(LogLevel.Info, ...args);
}

if (window.console) {
  console._log = console.log;
  console.log = consoleLog;
}

let globalLogger: undefined | pino.Logger;
let shouldRestart = false;

export function beforeRestart(): void {
  shouldRestart = true;
}

export function initialize(): void {
  if (globalLogger) {
    throw new Error('Already called initialize!');
  }

  const basePath = ipc.sendSync('get-user-data-path');
  const logFile = path.join(basePath, 'logs', 'app.log');

  const onClose = () => {
    globalLogger = undefined;

    if (shouldRestart) {
      initialize();
    }
  };

  const stream = createRotatingPinoDest({
    logFile,
  });

  stream.on('close', onClose);
  stream.on('error', onClose);

  globalLogger = pino(
    {
      formatters: {
        // No point in saving pid or hostname
        bindings: () => ({}),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream
  );
}

// A modern logging interface for the browser

function logAtLevel(level: LogLevel, ...args: ReadonlyArray<unknown>): void {
  if (getEnvironment() !== Environment.PackagedApp) {
    const prefix = getLogLevelString(level)
      .toUpperCase()
      .padEnd(levelMaxLength, ' ');
    console._log(prefix, now(), ...args);
  }

  const levelString = getLogLevelString(level);
  const msg = cleanArgs(args);

  if (!globalLogger) {
    throw new Error('Logger has not been initialized yet');
  }

  globalLogger[levelString](msg);
}

log.setLogAtLevel(logAtLevel);

window.SignalContext = window.SignalContext || {};
window.SignalContext.log = {
  fatal: log.fatal,
  error: log.error,
  warn: log.warn,
  info: log.info,
  debug: log.debug,
  trace: log.trace,
};

function toLocation(
  event: string | Event,
  sourceArg?: string,
  lineArg?: number,
  columnArg?: number
) {
  let source = sourceArg;
  let line = lineArg;
  let column = columnArg;

  if (event instanceof ErrorEvent) {
    source ??= event.filename;
    line ??= event.lineno;
    column ??= event.colno;
  }

  if (source == null) {
    return '(@ unknown)';
  }
  if (line != null && column != null) {
    return `(@ ${source}:${line}:${column})`;
  }
  if (line != null) {
    return `(@ ${source}:${line})`;
  }
  return `(@ ${source})`;
}

window.onerror = (event, source, line, column, error) => {
  const errorInfo = Errors.toLogFormat(error);
  log.error(
    `Top-level unhandled error: ${errorInfo}`,
    toLocation(event, source, line, column)
  );
};

window.addEventListener('unhandledrejection', rejectionEvent => {
  const error = rejectionEvent.reason;
  const errorString = Errors.toLogFormat(error);
  log.error(`Top-level unhandled promise rejection: ${errorString}`);
});

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
    const logString = `@signalapp/libsignal-client ${message} ${target}${fileString}`;

    if (level === SignalClientLogLevel.Trace) {
      log.trace(logString);
    } else if (level === SignalClientLogLevel.Debug) {
      log.debug(logString);
    } else if (level === SignalClientLogLevel.Info) {
      log.info(logString);
    } else if (level === SignalClientLogLevel.Warn) {
      log.warn(logString);
    } else if (level === SignalClientLogLevel.Error) {
      log.error(logString);
    } else {
      log.error(`${logString} (unknown log level ${level})`);
    }
  }
);
