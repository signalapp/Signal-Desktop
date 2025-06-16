// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pino from 'pino';

import type { LoggerType } from '../types/Logging';
import { Environment, getEnvironment } from '../environment';
import { reallyJsonStringify } from '../util/reallyJsonStringify';
import { getLogLevelString } from './shared';

// This file is imported by some components so we can't import `ts/util/privacy`
let redactAll = (value: string) => value;

let destination: pino.DestinationStream | undefined;
let buffer = new Array<string>();

const pinoInstance = pino(
  {
    formatters: {
      // No point in saving pid or hostname
      bindings: () => ({}),
    },
    hooks: {
      logMethod(args, method, level) {
        if (getEnvironment() !== Environment.PackagedApp) {
          const consoleMethod = getLogLevelString(level);

          const { msgPrefixSym } = pino.symbols as unknown as {
            readonly msgPrefixSym: unique symbol;
          };
          const msgPrefix = (
            this as unknown as Record<symbol, string | undefined>
          )[msgPrefixSym];

          const [message, ...extra] = args;

          // `fatal` has no respective analog in `console`
          // eslint-disable-next-line no-console
          console[consoleMethod === 'fatal' ? 'error' : consoleMethod](
            `${msgPrefix ?? ''}${message}`,
            ...extra
          );
        }

        // Always call original method, but with stringified arguments for
        // compatibility with existing logging.
        //
        // (Since pino >= 6 extra arguments that don't correspond to %d/%s/%j
        //  templates in the `message` are ignored)
        const line = args
          .map(item =>
            typeof item === 'string' ? item : reallyJsonStringify(item)
          )
          .join(' ');
        return method.call(this, line);
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['*'],
      censor: item => redactAll(item),
    },
  },
  {
    write(msg) {
      if (destination == null) {
        buffer.push(msg);
      } else {
        destination.write(msg);
      }
    },
  }
);

export const log: LoggerType = {
  fatal: pinoInstance.fatal.bind(pinoInstance),
  error: pinoInstance.error.bind(pinoInstance),
  warn: pinoInstance.error.bind(pinoInstance),
  info: pinoInstance.info.bind(pinoInstance),
  debug: pinoInstance.debug.bind(pinoInstance),
  trace: pinoInstance.trace.bind(pinoInstance),
  child: createLogger.bind(pinoInstance),
};

export function createLogger(name: string): LoggerType {
  const instance = pinoInstance.child({}, { msgPrefix: `[${name}] ` });

  return {
    fatal: instance.fatal.bind(instance),
    error: instance.error.bind(instance),
    warn: instance.warn.bind(instance),
    info: instance.info.bind(instance),
    debug: instance.debug.bind(instance),
    trace: instance.trace.bind(instance),
    child: createLogger.bind(instance),
  };
}

/**
 * Sets the low-level logging interface. Should be called early in a process's
 * life.
 */
export function setPinoDestination(
  newDestination: pino.DestinationStream,
  newRedactAll: typeof redactAll
): void {
  destination = newDestination;
  redactAll = newRedactAll;
  const queued = buffer;
  buffer = [];
  for (const msg of queued) {
    destination.write(msg);
  }
}
