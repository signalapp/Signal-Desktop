// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isTestOrMockEnvironment } from '../environment.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

export function areRemoteBackupsTurnedOn(): boolean {
  return itemStorage.get('backupTier') != null;
}

// Downloading from a remote backup is currently a test-only feature
export function canAttemptRemoteBackupDownload(): boolean {
  return isTestOrMockEnvironment();
}
