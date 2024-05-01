// NOTE: Temporarily allow `then` until we convert the entire file to `async` / `await`:
/* eslint-disable more/no-then */

import path from 'path';
import fs from 'fs';

import { app, ipcMain as ipc } from 'electron';
import Logger from 'bunyan';
import _ from 'lodash';
import firstline from 'firstline';
import { readLastLinesEnc } from 'read-last-lines-ts';
import rimraf from 'rimraf';

import { redactAll } from '../util/privacy';

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
let logger: Logger | undefined;

export type ConsoleCustom = typeof console & {
  _log: (...args: any) => void;
  _warn: (...args: any) => void;
  _error: (...args: any) => void;
};

export async function initializeLogger() {
  if (logger) {
    throw new Error('Already called initialize!');
  }

  const basePath = app.getPath('userData');
  const logPath = path.join(basePath, 'logs');
  fs.mkdirSync(logPath, { recursive: true });

  return cleanupLogs(logPath).then(() => {
    if (logger) {
      return;
    }

    const logFile = path.join(logPath, 'log.log');
    logger = Logger.createLogger({
      name: 'log',
      streams: [
        {
          level: 'debug',
          stream: process.stdout,
        },
        {
          type: 'rotating-file',
          path: logFile,
          period: '1d',
          count: 1,
        },
      ],
    });

    LEVELS.forEach(level => {
      ipc.on(`log-${level}`, (_first, ...rest) => {
        (logger as any)[level](...rest);
      });
    });

    ipc.on('fetch-log', event => {
      fs.mkdirSync(logPath, { recursive: true });
      console.info('fetching logs from logPath');

      fetchLogFile(logPath).then(
        data => {
          event.sender.send('fetched-log', data);
        },
        error => {
          logger?.error(`Problem loading log from disk: ${error.stack}`);
        }
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    ipc.on('delete-all-logs', async event => {
      try {
        await deleteAllLogs(logPath);
      } catch (error) {
        logger?.error(`Problem deleting all logs: ${error.stack}`);
      }

      event.sender.send('delete-all-logs-complete');
    });
  });
}

async function deleteAllLogs(logPath: string) {
  return new Promise((resolve, reject) => {
    rimraf(
      logPath,
      {
        disableGlob: true,
      },
      error => {
        if (error) {
          reject(error);
          return;
        }

        resolve(undefined);
      }
    );
  });
}

async function cleanupLogs(logPath: string) {
  const now = new Date();
  const earliestDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)
  );

  try {
    const remaining = await eliminateOutOfDateFiles(logPath, earliestDate);
    const files = _.filter(remaining, file => !file.start && file.end);

    if (!files.length) {
      return;
    }

    await eliminateOldEntries(files, earliestDate);
  } catch (error) {
    console.error('Error cleaning logs; deleting and starting over from scratch.', error.stack);

    // delete and re-create the log directory
    await deleteAllLogs(logPath);
    fs.mkdirSync(logPath, { recursive: true });
  }
}

function isLineAfterDate(line: string, date: Date) {
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

async function eliminateOutOfDateFiles(logPath: string, date: Date) {
  const files = fs.readdirSync(logPath);
  const paths = files.map(file => path.join(logPath, file));

  return Promise.all(
    _.map(paths, target =>
      Promise.all([firstline(target), readLastLinesEnc('utf8')(target, 2)]).then(results => {
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
      })
    )
  );
}

async function eliminateOldEntries(files: any, date: Date) {
  const earliest = date.getTime();

  return Promise.all(
    _.map(files, file =>
      fetchLog(file.path).then((lines: any) => {
        const recent = _.filter(lines, line => new Date(line.time).getTime() >= earliest);
        const text = _.map(recent, line => JSON.stringify(line)).join('\n');

        fs.writeFileSync(file.path, `${text}\n`);
      })
    )
  );
}

export function getLogger() {
  if (!logger) {
    throw new Error("Logger hasn't been initialized yet!");
  }

  return logger;
}

async function fetchLog(logFile: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(logFile, { encoding: 'utf8' }, (err, text) => {
      if (err) {
        reject(err);
        return;
      }

      const lines = _.compact(text.split('\n'));
      const data = _.compact(
        lines.map(line => {
          try {
            return _.pick(JSON.parse(line), ['level', 'time', 'msg']);
          } catch (e) {
            return null;
          }
        })
      );

      resolve(data);
    });
  });
}

export async function fetchLogFile(logPath: string) {
  // Check that the file exists locally
  if (!fs.existsSync(logPath)) {
    (console as ConsoleCustom)._log(
      'Log folder not found while fetching its content. Quick! Creating it.'
    );
    fs.mkdirSync(logPath, { recursive: true });
  }
  const files = fs.readdirSync(logPath);
  const paths = files.map(file => path.join(logPath, file));

  // creating a manual log entry for the final log result
  const now = new Date();
  const fileListEntry = {
    level: 30, // INFO
    time: now.toJSON(),
    msg: `Loaded this list of log files from logPath: ${files.join(', ')}`,
  };

  return Promise.all(paths.map(fetchLog)).then(results => {
    const data = _.flatten(results);

    data.push(fileListEntry);

    return _.sortBy(data, 'time');
  });
}

function logAtLevel(level: string, ...args: any) {
  if (logger) {
    // To avoid [Object object] in our log since console.log handles non-strings smoothly
    const str = args.map((item: any) => {
      if (typeof item !== 'string') {
        try {
          return JSON.stringify(item);
        } catch (e) {
          return item;
        }
      }

      return item;
    });
    (logger as any)[level](redactAll(str.join(' ')));
  } else {
    (console as ConsoleCustom)._log(...args);
  }
}

// This blows up using mocha --watch, so we ensure it is run just once
if (!(console as ConsoleCustom)._log) {
  (console as ConsoleCustom)._log = console.log;
  console.log = _.partial(logAtLevel, 'info');
  (console as ConsoleCustom)._error = console.error;
  console.error = _.partial(logAtLevel, 'error');
  (console as ConsoleCustom)._warn = console.warn;
  console.warn = _.partial(logAtLevel, 'warn');
}
