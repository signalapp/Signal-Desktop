// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEnvironment, Environment } from '../environment.std.js';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('deprecated');

export function deprecated(message?: string): void {
  if (getEnvironment() !== Environment.PackagedApp) {
    log.error(`This method is deprecated: ${message}`);
  }
}
