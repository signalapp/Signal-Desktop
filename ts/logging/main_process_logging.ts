// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// NOTE: Temporarily allow `then` until we convert the entire file to `async` / `await`:
/* eslint-disable more/no-then */
/* eslint-disable no-console */

import * as path from 'path';
import * as fs from 'fs';
import { app, ipcMain as ipc } from 'electron';
import pinoms from 'pino-multi-stream';
import pino from 'pino';
import * as mkdirp from 'mkdirp';
import * as _ from 'lodash';
import readFirstLine from 'firstline';
import { read as readLastLines } from 'read-last-lines';
import rimraf from 'rimraf';
import { createStream } from 'rotating-file-stream';

import {
  LogEntryType,
  LogLevel,
  cleanArgs,
  getLogLevelString,
  isLogEntry,
} from './shared';

declare global {
  // We want to extend `Console`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Console {
    _log: typeof console.log;
    _warn: typeof console.warn;
    _error: typeof console.error;
  }
}

let globalLogger: undefined | pinoms.Logger;

const isRunningFromConsole = Boolean(process.stdout.isTTY);

export async function initialize(): Promise<pinoms.Logger> {
  if (globalLogger) {
    throw new Error('Already called initialize!');
  }

  const basePath = app.getPath('userData');
  const logPath = path.join(basePath, 'logs');
  mkdirp.sync(logPath);

  try {
    await cleanupLogs(logPath);
  } catch (error) {
    const errorString = `Failed to clean logs; deleting all. Error: ${error.stack}`;
    console.error(errorString);
    await deleteAllLogs(logPath);
    mkdirp.sync(logPath);

    // If we want this log entry to persist on disk, we need to wait until we've
    //   set up our logging infrastructure.
    setTimeout(() => {
      console.error(errorString);
    }, 500);
  }

  const logFile = path.join(logPath, 'main.log');
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

  const streams: pinoms.Streams = [];
  streams.push({ stream });

  if (isRunningFromConsole) {
    streams.push({
      level: 'debug' as const,
      stream: process.stdout,
    });
  }

  const logger = pinoms({
    streams,
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  ipc.on('fetch-log', event => {
    fetch(logPath).then(
      data => {
        event.sender.send('fetched-log', data);
      },
      error => {
        logger.error(`Problem loading log from disk: ${error.stack}`);
      }
    );
  });

  ipc.on('delete-all-logs', async event => {
    try {
      await deleteAllLogs(logPath);
    } catch (error) {
      logger.error(`Problem deleting all logs: ${error.stack}`);
    }

    event.sender.send('delete-all-logs-complete');
  });

  globalLogger = logger;

  return logger;
}

async function deleteAllLogs(logPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    rimraf(
      logPath,
      {
        disableGlob: true,
      },
      error => {
        if (error) {
          return reject(error);
        }

        return resolve();
      }
    );
  });
}

async function cleanupLogs(logPath: string) {
  const now = new Date();
  const earliestDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3)
  );

  try {
    const remaining = await eliminateOutOfDateFiles(logPath, earliestDate);
    const files = _.filter(remaining, file => !file.start && file.end);

    if (!files.length) {
      return;
    }

    await eliminateOldEntries(files, earliestDate);
  } catch (error) {
    console.error(
      'Error cleaning logs; deleting and starting over from scratch.',
      error.stack
    );

    // delete and re-create the log directory
    await deleteAllLogs(logPath);
    mkdirp.sync(logPath);
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
    console.log('error parsing log line', e.stack, line);
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
  const files = fs.readdirSync(logPath);
  const paths = files.map(file => path.join(logPath, file));

  return Promise.all(
    _.map(paths, target =>
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
            fs.unlinkSync(file.path);
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
    _.map(files, file =>
      fetchLog(file.path).then(lines => {
        const recent = _.filter(lines, line => new Date(line.time) >= date);
        const text = _.map(recent, line => JSON.stringify(line)).join('\n');

        return fs.writeFileSync(file.path, `${text}\n`);
      })
    )
  );
}

// Exported for testing only.
export function fetchLog(logFile: string): Promise<Array<LogEntryType>> {
  return new Promise((resolve, reject) => {
    fs.readFile(logFile, { encoding: 'utf8' }, (err, text) => {
      if (err) {
        return reject(err);
      }

      const lines = _.compact(text.split('\n'));
      const data = _.compact(
        lines.map(line => {
          try {
            const result = _.pick(JSON.parse(line), ['level', 'time', 'msg']);
            return isLogEntry(result) ? result : null;
          } catch (e) {
            return null;
          }
        })
      );

      return resolve(data);
    });
  });
}

// Exported for testing only.
export function fetch(logPath: string): Promise<Array<LogEntryType>> {
  const files = fs.readdirSync(logPath);
  const paths = files.map(file => path.join(logPath, file));

  // creating a manual log entry for the final log result
  const fileListEntry: LogEntryType = {
    level: LogLevel.Info,
    time: new Date().toISOString(),
    msg: `Loaded this list of log files from logPath: ${files.join(', ')}`,
  };

  return Promise.all(paths.map(fetchLog)).then(results => {
    const data = _.flatten(results);

    data.push(fileListEntry);

    return _.sortBy(data, logEntry => logEntry.time);
  });
}

function logAtLevel(level: LogLevel, ...args: ReadonlyArray<unknown>) {
  if (globalLogger) {
    const levelString = getLogLevelString(level);
    globalLogger[levelString](cleanArgs(args));
  } else if (isRunningFromConsole) {
    console._log(...args);
  }
}

// This blows up using mocha --watch, so we ensure it is run just once
if (!console._log) {
  console._log = console.log;
  console.log = _.partial(logAtLevel, LogLevel.Info);
  console._error = console.error;
  console.error = _.partial(logAtLevel, LogLevel.Error);
  console._warn = console.warn;
  console.warn = _.partial(logAtLevel, LogLevel.Warn);
}
