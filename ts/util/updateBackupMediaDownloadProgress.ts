// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { throttle } from 'lodash';
import type { BackupAttachmentDownloadProgress } from '../sql/Interface';

export async function updateBackupMediaDownloadProgress(
  getBackupAttachmentDownloadProgress: () => Promise<BackupAttachmentDownloadProgress>
): Promise<void> {
  const { totalBytes, completedBytes } =
    await getBackupAttachmentDownloadProgress();

  await Promise.all([
    window.storage.put('backupMediaDownloadCompletedBytes', completedBytes),
    window.storage.put('backupMediaDownloadTotalBytes', totalBytes),
  ]);
}

export const throttledUpdateBackupMediaDownloadProgress = throttle(
  updateBackupMediaDownloadProgress,
  200
);
