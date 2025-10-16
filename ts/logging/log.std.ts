// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We use `window` below, but it is guarded by type checks
// eslint-disable-next-line local-rules/file-suffix
import pino from 'pino';
import { LRUCache } from 'lru-cache';

import type { LoggerType } from '../types/Logging.std.js';
import { Environment, getEnvironment } from '../environment.std.js';
import { reallyJsonStringify } from '../util/reallyJsonStringify.std.js';
import { getLogLevelString, type LogLevel } from './shared.std.js';

// This file is imported by some components so we can't import `ts/util/privacy`
let redactAll = (value: string) => value;

let destination: pino.DestinationStream | undefined;
let buffer = new Array<string>();

const COLORS = [
  '#2c6bed',
  '#cf163e',
  '#c73f0a',
  '#6f6a58',
  '#3b7845',
  '#1d8663',
  '#077d92',
  '#336ba3',
  '#6058ca',
  '#9932c8',
  '#aa377a',
  '#8f616a',
  '#71717f',
  '#ebeae8',
  '#506ecd',
  '#ff9500',
];

const SUBSYSTEM_COLORS = new LRUCache<string, string>({
  max: 500,
});

let onLogCallback: (level: number, logLine: string, msgPrefix?: string) => void;
export function setOnLogCallback(
  cb: (level: number, logLine: string, msgPrefix?: string) => void
): void {
  onLogCallback = cb;
}

// Only for unpackaged app
function getSubsystemColor(name: string): string {
  const cached = SUBSYSTEM_COLORS.get(name);
  if (cached != null) {
    return cached;
  }

  // Jenkins hash
  let hash = 0;

  /* eslint-disable no-bitwise */
  for (let i = 0; i < name.length; i += 1) {
    hash += name.charCodeAt(i) & 0xff;
    hash += hash << 10;
    hash ^= hash >>> 6;
  }
  hash += hash << 3;
  hash ^= hash >>> 11;
  hash += hash << 15;
  hash >>>= 0;
  /* eslint-enable no-bitwise */

  const result = COLORS[hash % COLORS.length];
  SUBSYSTEM_COLORS.set(name, result);

  return result;
}

let cachedPattern: RegExp | undefined;

if (typeof window !== 'undefined' && window.localStorage) {
  window.addEventListener('storage', event => {
    if (event.key === 'debug') {
      cachedPattern = undefined;
    }
  });
}

function getPattern(): RegExp {
  if (cachedPattern != null) {
    return cachedPattern;
  }

  let value = '';
  if (typeof window !== 'undefined' && window.localStorage) {
    value = window.localStorage.getItem('debug') || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    value = value || process.env.DEBUG || '';
  }

  const parts = value
    .trim()
    .replace(/\s+/g, ',')
    .split(',')
    .filter(part => part)
    .map(part => {
      const result = part
        .replace(/([^a-zA-Z0-9_\s*])/g, '\\$1')
        .replace('*', '.*');

      // Wrap with `[]` if not provided
      if (!/^\[.*\]/.test(part)) {
        return `\\[${result}\\]`;
      }
      return result;
    });

  if (parts.length === 0) {
    return /^.*$/;
  }

  const result = new RegExp(`^(${parts.join('|')})\\s+$`);
  cachedPattern = result;
  return result;
}

function debugLog(
  logger: typeof pinoInstance,
  args: Array<unknown>,
  level: LogLevel
): void {
  if (getEnvironment() === Environment.PackagedApp) {
    return;
  }

  const consoleMethod = getLogLevelString(level);

  const { msgPrefix } = logger;

  const pattern = getPattern();

  if (!pattern.test(msgPrefix ?? '')) {
    return;
  }

  const [message, ...extra] = args;

  const color = getSubsystemColor(msgPrefix ?? '');

  // `fatal` has no respective analog in `console`
  // eslint-disable-next-line no-console
  console[consoleMethod === 'fatal' ? 'error' : consoleMethod](
    `%c${msgPrefix ?? ''}%c${message}`,
    `color: ${color}; font-weight: bold`,
    'color: inherit; font-weight: inherit',
    ...extra
  );
}

const pinoInstance = pino(
  {
    formatters: {
      // No point in saving pid or hostname
      bindings: () => ({}),
    },
    hooks: {
      logMethod(args, method, level) {
        debugLog(this, args, level);

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
        onLogCallback?.(level, line, this.msgPrefix);

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
  child: child.bind(pinoInstance),
};

function child(this: typeof pinoInstance, name: string): LoggerType {
  const instance = this.child({}, { msgPrefix: `[${name}] ` });

  return {
    fatal: instance.fatal.bind(instance),
    error: instance.error.bind(instance),
    warn: instance.warn.bind(instance),
    info: instance.info.bind(instance),
    debug: instance.debug.bind(instance),
    trace: instance.trace.bind(instance),
    child: child.bind(instance),
  };
}

export const createLogger = log.child;

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
