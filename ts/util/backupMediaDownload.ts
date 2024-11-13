// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AttachmentDownloadManager } from '../jobs/AttachmentDownloadManager';
import { DataWriter } from '../sql/Client';
import { drop } from './drop';

export async function startBackupMediaDownload(): Promise<void> {
  await window.storage.put('backupMediaDownloadPaused', false);
  await window.storage.put('backupMediaDownloadIdle', false);

  await AttachmentDownloadManager.start();
  drop(
    AttachmentDownloadManager.waitForIdle(async () => {
      await window.storage.put('backupMediaDownloadIdle', true);
    })
  );
}

export async function pauseBackupMediaDownload(): Promise<void> {
  await window.storage.put('backupMediaDownloadPaused', true);
}

export async function resumeBackupMediaDownload(): Promise<void> {
  return startBackupMediaDownload();
}

export async function resetBackupMediaDownloadItems(): Promise<void> {
  await Promise.all([
    window.storage.remove('backupMediaDownloadTotalBytes'),
    window.storage.remove('backupMediaDownloadCompletedBytes'),
    window.storage.remove('backupMediaDownloadBannerDismissed'),
    window.storage.remove('backupMediaDownloadPaused'),
    window.storage.remove('backupMediaDownloadIdle'),
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
