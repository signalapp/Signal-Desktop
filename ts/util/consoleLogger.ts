// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../types/Logging';

/* eslint-disable no-console */
export const consoleLogger: LoggerType = {
  fatal(...args) {
    console.error(...args);
  },
  error(...args) {
    console.error(...args);
  },
  warn(...args) {
    console.warn(...args);
  },
  info(...args) {
    console.info(...args);
  },
  debug(...args) {
    console.debug(...args);
  },
  trace(...args) {
    console.log(...args);
  },
  child() {
    throw new Error('Not supported');
  },
};

/* eslint-enable no-console */
