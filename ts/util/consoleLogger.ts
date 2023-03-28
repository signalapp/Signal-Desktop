// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../types/Logging';

/* eslint-disable no-console */
export const consoleLogger: LoggerType = {
  fatal(...args: Array<unknown>) {
    console.error(...args);
  },
  error(...args: Array<unknown>) {
    console.error(...args);
  },
  warn(...args: Array<unknown>) {
    console.warn(...args);
  },
  info(...args: Array<unknown>) {
    console.info(...args);
  },
  debug(...args: Array<unknown>) {
    console.debug(...args);
  },
  trace(...args: Array<unknown>) {
    console.log(...args);
  },
};

export type BufferedLoggerType = LoggerType & {
  writeBufferInto(logger: LoggerType): void;
};

export function createBufferedConsoleLogger(): BufferedLoggerType {
  type BufferEntryType = Readonly<{
    level: keyof LoggerType;
    args: Array<unknown>;
  }>;
  const buffer = new Array<BufferEntryType>();
  return {
    fatal(...args: Array<unknown>) {
      buffer.push({ level: 'fatal', args });
      console.error(...args);
    },
    error(...args: Array<unknown>) {
      buffer.push({ level: 'error', args });
      console.error(...args);
    },
    warn(...args: Array<unknown>) {
      buffer.push({ level: 'warn', args });
      console.warn(...args);
    },
    info(...args: Array<unknown>) {
      buffer.push({ level: 'info', args });
      console.info(...args);
    },
    debug(...args: Array<unknown>) {
      buffer.push({ level: 'debug', args });
      console.debug(...args);
    },
    trace(...args: Array<unknown>) {
      buffer.push({ level: 'trace', args });
      console.log(...args);
    },

    writeBufferInto(output) {
      for (const { level, args } of buffer) {
        output[level](...args);
      }
    },
  };
}
/* eslint-enable no-console */
