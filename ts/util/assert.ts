// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEnvironment, Environment } from '../environment';
import * as log from '../logging/log';

/**
 * In production, logs an error and continues. In all other environments, throws an error.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    const err = new Error(message);
    if (getEnvironment() !== Environment.Production) {
      if (getEnvironment() === Environment.Development) {
        debugger; // eslint-disable-line no-debugger
      }
      throw err;
    }
    log.error(err);
  }
}
