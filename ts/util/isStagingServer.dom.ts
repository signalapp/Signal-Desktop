// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Environment, getEnvironment } from '../environment.std.js';
import { isStaging } from './version.std.js';

export function isStagingServer(
  serverUrl = window.SignalContext.config.serverUrl
): boolean {
  if (getEnvironment() === Environment.Staging) {
    return true;
  }
  if (isStaging(window.SignalContext.getVersion())) {
    return true;
  }
  return /staging/i.test(serverUrl);
}
