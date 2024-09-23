// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataWriter } from '../sql/Client';

export async function pauseBackupMediaDownload(): Promise<void> {
  await window.storage.put('backupMediaDownloadPaused', true);
}

export async function resumeBackupMediaDownload(): Promise<void> {
  await window.storage.put('backupMediaDownloadPaused', false);
}

export async function resetBackupMediaDownloadItems(): Promise<void> {
  await Promise.all([
    window.storage.remove('backupMediaDownloadTotalBytes'),
    window.storage.remove('backupMediaDownloadCompletedBytes'),
    window.storage.remove('backupMediaDownloadBannerDismissed'),
    window.storage.remove('backupMediaDownloadPaused'),
  ]);
}

export async function cancelBackupMediaDownload(): Promise<void> {
  await DataWriter.removeAllBackupAttachmentDownloadJobs();
  await resetBackupMediaDownloadItems();
}

export async function resetBackupMediaDownloadProgress(): Promise<void> {
  await resetBackupMediaDownloadItems();
}

export async function dismissBackupMediaDownloadBanner(): Promise<void> {
  await window.storage.put('backupMediaDownloadBannerDismissed', true);
}
