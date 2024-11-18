// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// NOTE: Temporarily allow `then` until we convert the entire file to `async` / `await`:
/* eslint-disable more/no-then */
/* eslint-disable no-console */

import { CircularBuffer } from 'cirbuf';
import type { BrowserWindow } from 'electron';
import { app, ipcMain as ipc } from 'electron';
import readFirstLine from 'firstline';
import { filter, flatten, map, noop, pick, sortBy } from 'lodash';
import {
  createReadStream,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'path';
import type { StreamEntry } from 'pino';
import pino from 'pino';
import { read as readLastLines } from 'read-last-lines';
import split2 from 'split2';

import type { LoggerType } from '../types/Logging';
import * as Errors from '../types/errors';
import { createRotatingPinoDest } from '../util/rotatingPinoDest';

import { Environment, getEnvironment } from '../environment';
import * as log from './log';

import type { FetchLogIpcData, LogEntryType } from './shared';
import { LogLevel, cleanArgs, getLogLevelString, isLogEntry } from './shared';

declare global {
  // We want to extend `Console`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Console {
    _log: typeof console.log;
    _warn: typeof console.warn;
    _error: typeof console.error;
  }
}

const MAX_LOG_LINES = 10_000_000;

let globalLogger: undefined | pino.Logger;
let shouldRestart = false;

const isRunningFromConsole =
  Boolean(process.stdout.isTTY) || getEnvironment() === Environment.Test;

export async function initialize(
  getMainWindow: () => undefined | BrowserWindow
): Promise<LoggerType> {
  if (globalLogger) {
    throw new Error('Already called initialize!');
  }

  const basePath = app.getPath('userData');
  const logPath = join(basePath, 'logs');
  mkdirSync(logPath, { recursive: true });

  try {
    await cleanupLogs(logPath);
  } catch (error) {
    const errorString =
      'Failed to clean logs; deleting all. ' +
      `Error: ${Errors.toLogFormat(error)}`;
    console.error(errorString);
    await deleteAllLogs(logPath);
    mkdirSync(logPath, { recursive: true });

    // If we want this log entry to persist on disk, we need to wait until we've
    //   set up our logging infrastructure.
    setTimeout(() => {
      console.error(errorString);
    }, 500);
  }

  const logFile = join(logPath, 'main.log');
  const rotatingStream = createRotatingPinoDest({
    logFile,
  });

  const onClose = () => {
    globalLogger = undefined;

    if (shouldRestart) {
      void initialize(getMainWindow);
    }
  };

  rotatingStream.on('close', onClose);
  rotatingStream.on('error', onClose);

  const streams = new Array<StreamEntry>();
  streams.push({ stream: rotatingStream });

  if (isRunningFromConsole) {
    process.stdout.on('error', noop);

    streams.push({
      level: 'debug' as const,
      stream: process.stdout,
    });
  }

  const logger = pino(
    {
      formatters: {
        // No point in saving pid or hostname
        bindings: () => ({}),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams)
  );

  ipc.removeHandler('fetch-log');
  ipc.handle('fetch-log', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      logger.info('Logs were requested, but the main window is missing');
      return;
    }

    let data: FetchLogIpcData;
    try {
      const [logEntries, rest] = await Promise.all([
        fetchLogs(logPath),
        fetchAdditionalLogData(mainWindow),
      ]);
      data = {
        logEntries,
        ...rest,
      };
    } catch (error) {
      logger.error(`Problem loading log data: ${Errors.toLogFormat(error)}`);
      return;
    }

    return data;
  });

  ipc.removeHandler('delete-all-logs');
  ipc.handle('delete-all-logs', async () => {
    // Restart logging when the streams will close
    shouldRestart = true;

    try {
      await deleteAllLogs(logPath);
    } catch (error) {
      logger.error(`Problem deleting all logs: ${Errors.toLogFormat(error)}`);
    }
  });

  globalLogger = logger;

  return log;
}

async function deleteAllLogs(logPath: string): Promise<void> {
  await rm(logPath, { recursive: true, force: true });
}

async function cleanupLogs(logPath: string) {
  const now = new Date();
  const earliestDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3)
  );

  try {
    const remaining = await eliminateOutOfDateFiles(logPath, earliestDate);
    const files = filter(remaining, file => !file.start && file.end);

    if (!files.length) {
      return;
    }

    await eliminateOldEntries(files, earliestDate);
  } catch (error) {
    console.error(
      'Error cleaning logs; deleting and starting over from scratch.',
      Errors.toLogFormat(error)
    );

    // delete and re-create the log directory
    await deleteAllLogs(logPath);
    mkdirSync(logPath, { recursive: true });
  }
}

// Exported for testing only.
export function isLineAfterDate(line: string, date: Readonly<Date>): boolean {
  if (!line) {
    return false;
  }

  try {
    const data = JSON.parse(line);
    return new Date(data.time).getTime() > date.getTime();
  } catch (e) {
    console.log('error parsing log line', Errors.toLogFormat(e), line);
    return false;
  }
}

// Exported for testing only.
export function eliminateOutOfDateFiles(
  logPath: string,
  date: Readonly<Date>
): Promise<
  Array<{
    path: string;
    start: boolean;
    end: boolean;
  }>
> {
  const files = readdirSync(logPath);
  const paths = files.map(file => join(logPath, file));

  return Promise.all(
    map(paths, target =>
      Promise.all([readFirstLine(target), readLastLines(target, 2)]).then(
        results => {
          const start = results[0];
          const end = results[1].split('\n');

          const file = {
            path: target,
            start: isLineAfterDate(start, date),
            end:
              isLineAfterDate(end[end.length - 1], date) ||
              isLineAfterDate(end[end.length - 2], date),
          };

          if (!file.start && !file.end) {
            unlinkSync(file.path);
          }

          return file;
        }
      )
    )
  );
}

// Exported for testing only.
export async function eliminateOldEntries(
  files: ReadonlyArray<{ path: string }>,
  date: Readonly<Date>
): Promise<void> {
  await Promise.all(
    map(files, file =>
      fetchLog(file.path).then(lines => {
        const recent = filter(lines, line => new Date(line.time) >= date);
        const text = map(recent, line => JSON.stringify(line)).join('\n');

        return writeFileSync(file.path, `${text}\n`);
      })
    )
  );
}

// Exported for testing only.
export async function fetchLog(logFile: string): Promise<Array<LogEntryType>> {
  const results = new CircularBuffer<LogEntryType>(MAX_LOG_LINES);

  const rawStream = createReadStream(logFile);
  const jsonStream = rawStream.pipe(
    split2(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return undefined;
      }
    })
  );

  // Propagate fs errors down to the json stream so that for loop below handles
  // them.
  rawStream.on('error', error => jsonStream.emit('error', error));

  for await (const line of jsonStream) {
    const result = line && pick(line, ['level', 'time', 'msg']);
    if (!isLogEntry(result)) {
      continue;
    }

    results.push(result);
  }

  return results.toArray();
}

// Exported for testing only.
export function fetchLogs(logPath: string): Promise<Array<LogEntryType>> {
  const files = readdirSync(logPath);
  const paths = files.map(file => join(logPath, file));

  // creating a manual log entry for the final log result
  const fileListEntry: LogEntryType = {
    level: LogLevel.Info,
    time: new Date().toISOString(),
    msg: `Loaded this list of log files from logPath: ${files.join(', ')}`,
  };

  return Promise.all(paths.map(fetchLog)).then(results => {
    const data = flatten(results);

    data.push(fileListEntry);

    return sortBy(data, logEntry => logEntry.time);
  });
}

export const fetchAdditionalLogData = (
  mainWindow: BrowserWindow
): Promise<Omit<FetchLogIpcData, 'logEntries'>> =>
  new Promise(resolve => {
    mainWindow.webContents.send('additional-log-data-request');
    ipc.once('additional-log-data-response', (_event, data) => {
      resolve(data);
    });
  });

function logAtLevel(level: LogLevel, ...args: ReadonlyArray<unknown>) {
  if (globalLogger) {
    const levelString = getLogLevelString(level);
    globalLogger[levelString](cleanArgs(args));
  } else if (isRunningFromConsole && !process.stdout.destroyed) {
    console._log(...args);
  }
}

// This blows up using mocha --watch, so we ensure it is run just once
if (!console._log) {
  log.setLogAtLevel(logAtLevel);

  console._log = console.log;
  console.log = log.info;
  console._error = console.error;
  console.error = log.error;
  console._warn = console.warn;
  console.warn = log.warn;
}
