// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-env node */

/* eslint-disable no-console */

import { ipcRenderer as ipc } from 'electron';
import _ from 'lodash';
import * as path from 'path';
import pino from 'pino';
import { createStream } from 'rotating-file-stream';

import { uploadDebugLogs } from './debuglogs';
import { redactAll } from '../../js/modules/privacy';
import {
  LogEntryType,
  LogLevel,
  cleanArgs,
  getLogLevelString,
  isLogEntry,
} from './shared';
import * as log from './log';
import { reallyJsonStringify } from '../util/reallyJsonStringify';

// To make it easier to visually scan logs, we make all levels the same length
const levelFromName = pino().levels.values;
const levelMaxLength: number = Object.keys(levelFromName).reduce(
  (maxLength, level) => Math.max(maxLength, level.length),
  0
);

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

// The mechanics of preparing a log for publish

function getHeader() {
  let header = window.navigator.userAgent;

  header += ` node/${window.getNodeVersion()}`;
  header += ` env/${window.getEnvironment()}`;

  return header;
}

const getLevel = _.memoize((level: LogLevel): string => {
  const text = getLogLevelString(level);
  return text.toUpperCase().padEnd(levelMaxLength, ' ');
});

function formatLine(mightBeEntry: Readonly<unknown>): string {
  const entry: LogEntryType = isLogEntry(mightBeEntry)
    ? mightBeEntry
    : {
        level: LogLevel.Error,
        msg: `Invalid IPC data when fetching logs. Here's what we could recover: ${reallyJsonStringify(
          mightBeEntry
        )}`,
        time: new Date().toISOString(),
      };

  return `${getLevel(entry.level)} ${entry.time} ${entry.msg}`;
}

function fetch(): Promise<string> {
  return new Promise(resolve => {
    ipc.send('fetch-log');

    ipc.on('fetched-log', (_event, logEntries: unknown) => {
      let body: string;
      if (Array.isArray(logEntries)) {
        body = logEntries.map(formatLine).join('\n');
      } else {
        const entry: LogEntryType = {
          level: LogLevel.Error,
          msg: 'Invalid IPC data when fetching logs; dropping all logs',
          time: new Date().toISOString(),
        };
        body = formatLine(entry);
      }

      const result = `${getHeader()}\n${redactAll(body)}`;
      resolve(result);
    });
  });
}

let globalLogger: undefined | pino.Logger;

export function initialize(): void {
  if (globalLogger) {
    throw new Error('Already called initialize!');
  }

  const basePath = ipc.sendSync('get-user-data-path');
  const logFile = path.join(basePath, 'logs', 'app.log');
  const stream = createStream(logFile, {
    interval: '1d',
    rotate: 3,
  });

  stream.on('close', () => {
    globalLogger = undefined;
  });

  stream.on('error', () => {
    globalLogger = undefined;
  });

  globalLogger = pino(
    {
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream
  );
}

const publish = uploadDebugLogs;

// A modern logging interface for the browser

const env = window.getEnvironment();
const IS_PRODUCTION = env === 'production';

function logAtLevel(level: LogLevel, ...args: ReadonlyArray<unknown>): void {
  if (!IS_PRODUCTION) {
    const prefix = getLogLevelString(level)
      .toUpperCase()
      .padEnd(levelMaxLength, ' ');
    console._log(prefix, now(), ...args);
  }

  const levelString = getLogLevelString(level);
  const msg = cleanArgs(args);

  if (!globalLogger) {
    throw new Error('Logger has not been initialized yet');
    return;
  }

  globalLogger[levelString](msg);
}

log.setLogAtLevel(logAtLevel);

window.log = {
  fatal: log.fatal,
  error: log.error,
  warn: log.warn,
  info: log.info,
  debug: log.debug,
  trace: log.trace,
  fetch,
  publish,
};

window.onerror = (_message, _script, _line, _col, error) => {
  const errorInfo = error && error.stack ? error.stack : JSON.stringify(error);
  window.log.error(`Top-level unhandled error: ${errorInfo}`);
};

window.addEventListener('unhandledrejection', rejectionEvent => {
  const error = rejectionEvent.reason;
  const errorString =
    error && error.stack ? error.stack : JSON.stringify(error);
  window.log.error(`Top-level unhandled promise rejection: ${errorString}`);
});
