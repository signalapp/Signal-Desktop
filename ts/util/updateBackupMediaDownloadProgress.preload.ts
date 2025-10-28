// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { BackupAttachmentDownloadProgress } from '../sql/Interface.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { throttle } = lodash;

export async function updateBackupMediaDownloadProgress(
  getBackupAttachmentDownloadProgress: () => Promise<BackupAttachmentDownloadProgress>
): Promise<void> {
  const { totalBytes, completedBytes } =
    await getBackupAttachmentDownloadProgress();

  await Promise.all([
    itemStorage.put('backupMediaDownloadCompletedBytes', completedBytes),
    itemStorage.put('backupMediaDownloadTotalBytes', totalBytes),
  ]);
}

export const throttledUpdateBackupMediaDownloadProgress = throttle(
  updateBackupMediaDownloadProgress,
  200
);
