// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { parentPort } from 'node:worker_threads';
import { format } from 'node:util';

import type { LoggerType } from '../types/Logging';
import type { WrappedWorkerLogEntry, WrappedWorkerResponse } from './main';
import { consoleLogger } from '../util/consoleLogger';
import { strictAssert } from '../util/assert';

class SQLLogger {
  #msgPrefix: string;

  constructor(msgPrefix: string) {
    this.#msgPrefix = msgPrefix;
  }

  fatal(...args: Array<unknown>) {
    this.#log('fatal', args);
  }
  error(...args: Array<unknown>) {
    this.#log('error', args);
  }
  warn(...args: Array<unknown>) {
    this.#log('warn', args);
  }
  info(...args: Array<unknown>) {
    this.#log('info', args);
  }
  debug(...args: Array<unknown>) {
    this.#log('debug', args);
  }
  trace(...args: Array<unknown>) {
    this.#log('trace', args);
  }
  child(subsystem: string) {
    return new SQLLogger(`${this.#msgPrefix}[${subsystem}] `);
  }

  #log(level: WrappedWorkerLogEntry['level'], args: Array<unknown>): void {
    if (parentPort) {
      const [fmt, ...rest] = args;

      const wrappedResponse: WrappedWorkerResponse = {
        type: 'log',
        level,
        args: ([this.#msgPrefix + fmt] as Array<unknown>).concat(rest),
      };
      parentPort.postMessage(wrappedResponse);
    } else {
      strictAssert(process.env.NODE_ENV === 'test', 'must be test environment');
      consoleLogger[level](this.#msgPrefix + format(...args));
    }
  }
}

export const sqlLogger: LoggerType = new SQLLogger('');
