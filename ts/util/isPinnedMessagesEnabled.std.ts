// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../environment.std.js';

export function isPinnedMessagesEnabled(): boolean {
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    isMockEnvironment()
  ) {
    return true;
  }

  return false;
}
