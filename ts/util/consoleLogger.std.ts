// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../types/Logging.std.js';

export const consoleLogger: LoggerType = {
  fatal(...args) {
    // oxlint-disable-next-line no-console
    console.error(...args);
  },
  error(...args) {
    // oxlint-disable-next-line no-console
    console.error(...args);
  },
  warn(...args) {
    // oxlint-disable-next-line no-console
    console.warn(...args);
  },
  info(...args) {
    // oxlint-disable-next-line no-console
    console.info(...args);
  },
  debug(...args) {
    // oxlint-disable-next-line no-console
    console.debug(...args);
  },
  trace(...args) {
    // oxlint-disable-next-line no-console
    console.log(...args);
  },
  child() {
    return consoleLogger;
  },
};
