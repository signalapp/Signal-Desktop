// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
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
const logEntrySchema = z.object({
  level: z.nativeEnum(LogLevel),
  msg: z.string(),
  time: z.string().refine(value => !Number.isNaN(new Date(value).getTime())),
});
export type LogEntryType = z.infer<typeof logEntrySchema>;

export const isLogEntry = logEntrySchema.check.bind(logEntrySchema);

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
