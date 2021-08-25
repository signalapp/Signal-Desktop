// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-env node */

/* eslint-disable no-console */

import { ipcRenderer as ipc } from 'electron';
import _ from 'lodash';
import * as path from 'path';
import pino from 'pino';
import { createStream } from 'rotating-file-stream';

import {
  initLogger,
  LogLevel as SignalClientLogLevel,
} from '@signalapp/signal-client';

import { uploadDebugLogs } from './debuglogs';
import { redactAll } from '../util/privacy';
import {
  FetchLogIpcData,
  LogEntryType,
  LogLevel,
  cleanArgs,
  getLogLevelString,
  isFetchLogIpcData,
  isLogEntry,
} from './shared';
import * as log from './log';
import { reallyJsonStringify } from '../util/reallyJsonStringify';
import { Environment, getEnvironment } from '../environment';

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

const headerSectionTitle = (title: string) => `========= ${title} =========`;

const headerSection = (
  title: string,
  data: Readonly<Record<string, unknown>>
): string => {
  const sortedEntries = _.sortBy(Object.entries(data), ([key]) => key);
  return [
    headerSectionTitle(title),
    ...sortedEntries.map(
      ([key, value]) => `${key}: ${redactAll(String(value))}`
    ),
    '',
  ].join('\n');
};

const getHeader = ({
  capabilities,
  remoteConfig,
  statistics,
  user,
}: Omit<FetchLogIpcData, 'logEntries'>): string =>
  [
    headerSection('System info', {
      Time: Date.now(),
      'User agent': window.navigator.userAgent,
      'Node version': window.getNodeVersion(),
      Environment: getEnvironment(),
      'App version': window.getVersion(),
    }),
    headerSection('User info', user),
    headerSection('Capabilities', capabilities),
    headerSection('Remote config', remoteConfig),
    headerSection('Statistics', statistics),
    headerSectionTitle('Logs'),
  ].join('\n');

const getLevel = _.memoize((level: LogLevel): string => {
  const text = getLogLevelString(level);
  return text.toUpperCase().padEnd(levelMaxLength, ' ');
});

function formatLine(mightBeEntry: unknown): string {
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

    ipc.on('fetched-log', (_event, data: unknown) => {
      let header: string;
      let body: string;
      if (isFetchLogIpcData(data)) {
        const { logEntries } = data;
        header = getHeader(data);
        body = logEntries.map(formatLine).join('\n');
      } else {
        header = headerSectionTitle('Partial logs');
        const entry: LogEntryType = {
          level: LogLevel.Error,
          msg: 'Invalid IPC data when fetching logs; dropping all logs',
          time: new Date().toISOString(),
        };
        body = formatLine(entry);
      }

      const result = `${header}\n${body}`;
      resolve(result);
    });
  });
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
  const stream = createStream(logFile, {
    interval: '1d',
    rotate: 3,
  });

  const onClose = () => {
    globalLogger = undefined;

    if (shouldRestart) {
      initialize();
    }
  };

  stream.on('close', onClose);
  stream.on('error', onClose);

  globalLogger = pino(
    {
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream
  );
}

const publish = uploadDebugLogs;

// A modern logging interface for the browser

function logAtLevel(level: LogLevel, ...args: ReadonlyArray<unknown>): void {
  if (getEnvironment() !== Environment.Production) {
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

initLogger(
  SignalClientLogLevel.Warn,
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
    const logString = `@signalapp/signal-client ${message} ${target}${fileString}`;

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
