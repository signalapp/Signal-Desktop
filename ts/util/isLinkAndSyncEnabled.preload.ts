// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { backupsService } from '../services/backups/index.preload.ts';
import { everDone as wasRegistrationEverDone } from './registration.preload.ts';

export function isLinkAndSyncEnabled(): boolean {
  // Cannot overwrite existing message history
  if (wasRegistrationEverDone()) {
    return false;
  }

  // For local backup import testing, prevent link & sync
  if (backupsService.isLocalBackupStaged()) {
    return false;
  }

  return true;
}
