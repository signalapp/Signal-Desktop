// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pino from 'pino';
import { isRecord } from '../util/isRecord.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { LogLevel } from '../types/Logging.std.js';

export { LogLevel };

export type FetchLogIpcData = {
  capabilities: Record<string, unknown>;
  remoteConfig: Record<string, unknown>;
  statistics: Record<string, unknown>;
  user: Record<string, unknown>;

  // We expect `logEntries` to be `Array<LogEntryType>`, but we don't validate that
  //   upfront—we only validate it when we go to log each line. This improves the
  //   performance, because we don't have to iterate over every single log entry twice. It
  //   also means we can log entries if only some of them are invalid.
  logEntries: Array<unknown>;
};

// We don't use Zod here because it'd be slow parsing all of the log entries.
//   Unfortunately, Zod is a bit slow even with `z.array(z.unknown())`.
export const isFetchLogIpcData = (data: unknown): data is FetchLogIpcData =>
  isRecord(data) &&
  isRecord(data.capabilities) &&
  isRecord(data.remoteConfig) &&
  isRecord(data.statistics) &&
  isRecord(data.user) &&
  Array.isArray(data.logEntries);

// These match [Pino's core fields][1].
// [1]: https://getpino.io/#/?id=usage
export type LogEntryType = Readonly<{
  level: LogLevel;
  msg: string;
  time: string;
}>;

// The code below is performance sensitive since it runs for > 100k log entries
// whenever we want to send the debug log. We can't use `zod` because it clones
// the data on successful parse and ruins the performance.
export const isLogEntry = (data: unknown): data is LogEntryType => {
  if (!isRecord(data)) {
    return false;
  }

  const { level, msg, time } = data as Partial<LogEntryType>;

  if (typeof level !== 'number') {
    return false;
  }

  if (!LogLevel[level]) {
    return false;
  }

  if (typeof msg !== 'string') {
    return false;
  }

  if (typeof time !== 'string') {
    return false;
  }

  return !Number.isNaN(new Date(time).getTime());
};

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

// To make it easier to visually scan logs, we make all levels the same length
const levelFromName = pino().levels.values;
export const levelMaxLength: number = Object.keys(levelFromName).reduce(
  (maxLength, level) => Math.max(maxLength, level.length),
  0
);
