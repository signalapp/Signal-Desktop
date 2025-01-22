// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isProduction } from './version';
import { everDone as wasRegistrationEverDone } from './registration';

export function isLinkAndSyncEnabled(version: string): boolean {
  // Cannot overwrite existing message history
  if (wasRegistrationEverDone()) {
    return false;
  }

  return !isProduction(version);
}
