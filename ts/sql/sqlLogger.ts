// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { parentPort } from 'node:worker_threads';
import { format } from 'node:util';

import type { LoggerType } from '../types/Logging';
import type { WrappedWorkerLogEntry, WrappedWorkerResponse } from './main';
import { consoleLogger } from '../util/consoleLogger';
import { strictAssert } from '../util/assert';

const log = (
  level: WrappedWorkerLogEntry['level'],
  args: Array<unknown>
): void => {
  if (parentPort) {
    const wrappedResponse: WrappedWorkerResponse = {
      type: 'log',
      level,
      args,
    };
    parentPort.postMessage(wrappedResponse);
  } else {
    strictAssert(process.env.NODE_ENV === 'test', 'must be test environment');
    consoleLogger[level](format(...args));
  }
};

export const sqlLogger: LoggerType = {
  fatal(...args: Array<unknown>) {
    log('fatal', args);
  },
  error(...args: Array<unknown>) {
    log('error', args);
  },
  warn(...args: Array<unknown>) {
    log('warn', args);
  },
  info(...args: Array<unknown>) {
    log('info', args);
  },
  debug(...args: Array<unknown>) {
    log('debug', args);
  },
  trace(...args: Array<unknown>) {
    log('trace', args);
  },
  child() {
    return sqlLogger;
  },
};
