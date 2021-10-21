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
/* eslint-enable no-console */
