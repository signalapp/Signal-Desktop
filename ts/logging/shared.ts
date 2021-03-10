// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as pino from 'pino';
import { redactAll } from '../../js/modules/privacy';
import { missingCaseError } from '../util/missingCaseError';
import { reallyJsonStringify } from '../util/reallyJsonStringify';

// These match [Pino's recommendations][0].
// [0]: https://getpino.io/#/docs/api?id=loggerlevels-object
export enum LogLevel {
  Fatal = 60,
  Error = 50,
  Warn = 40,
  Info = 30,
  Debug = 20,
  Trace = 10,
}

// These match [Pino's core fields][1].
// [1]: https://getpino.io/#/?id=usage
export type LogEntryType = {
  level: LogLevel;
  msg: string;
  time: string;
};

const logLevels = new Set<LogLevel>([
  LogLevel.Fatal,
  LogLevel.Error,
  LogLevel.Warn,
  LogLevel.Info,
  LogLevel.Debug,
  LogLevel.Trace,
]);
function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'number' && logLevels.has(value);
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

export function isLogEntry(value: unknown): value is LogEntryType {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const { level, time, msg } = value as Record<string, unknown>;

  return typeof msg === 'string' && isLogLevel(level) && isValidTime(time);
}

export function getLogLevelString(value: LogLevel): pino.Level {
  switch (value) {
    case LogLevel.Fatal:
      return 'fatal';
    case LogLevel.Error:
      return 'error';
    case LogLevel.Warn:
      return 'warn';
    case LogLevel.Info:
      return 'info';
    case LogLevel.Debug:
      return 'debug';
    case LogLevel.Trace:
      return 'trace';
    default:
      throw missingCaseError(value);
  }
}

export function cleanArgs(args: ReadonlyArray<unknown>): string {
  return redactAll(
    args
      .map(item =>
        typeof item === 'string' ? item : reallyJsonStringify(item)
      )
      .join(' ')
  );
}
