// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Environment, getEnvironment } from '../environment';
import { isStaging } from './version';

export function isStagingServer(
  serverUrl = window.SignalContext.config.serverUrl
): boolean {
  if (getEnvironment() === Environment.Staging) {
    return true;
  }
  if (isStaging(window.getVersion())) {
    return true;
  }
  return /staging/i.test(serverUrl);
}
