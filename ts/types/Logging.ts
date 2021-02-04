// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

type LogFunction = (...args: Array<unknown>) => void;

export type LoggerType = {
  fatal: LogFunction;
  error: LogFunction;
  warn: LogFunction;
  info: LogFunction;
  debug: LogFunction;
  trace: LogFunction;
};
