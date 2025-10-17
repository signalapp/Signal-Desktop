// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type LoggingFn = (msg: string, ...args: Array<unknown>) => void;

export type LoggerType = {
  fatal: LoggingFn;
  error: LoggingFn;
  warn: LoggingFn;
  info: LoggingFn;
  debug: LoggingFn;
  trace: LoggingFn;

  child: (name: string) => LoggerType;
};

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
