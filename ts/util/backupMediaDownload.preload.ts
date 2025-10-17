// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AttachmentDownloadManager } from '../jobs/AttachmentDownloadManager.preload.js';
import { createLogger } from '../logging/log.std.js';
import { DataWriter } from '../sql/Client.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('backupMediaDownload');

export async function startBackupMediaDownload(): Promise<void> {
  await itemStorage.put('backupMediaDownloadPaused', false);

  await AttachmentDownloadManager.start();
}

export async function pauseBackupMediaDownload(): Promise<void> {
  log.info('Pausing media download');
  await itemStorage.put('backupMediaDownloadPaused', true);
}

export async function resumeBackupMediaDownload(): Promise<void> {
  log.info('Resuming media download');
  // Reset the retry-afters so that all jobs will be immediately retried
  await DataWriter.resetBackupAttachmentDownloadJobsRetryAfter();
  return startBackupMediaDownload();
}

export async function resetBackupMediaDownloadItems(): Promise<void> {
  await Promise.all([
    itemStorage.remove('backupMediaDownloadTotalBytes'),
    itemStorage.remove('backupMediaDownloadCompletedBytes'),
    itemStorage.remove('backupMediaDownloadBannerDismissed'),
    itemStorage.remove('backupMediaDownloadPaused'),
  ]);
}

export async function cancelBackupMediaDownload(): Promise<void> {
  log.info('Canceling media download');
  await dismissBackupMediaDownloadBanner();
  await DataWriter.removeAllBackupAttachmentDownloadJobs();
  await resetBackupMediaDownloadStats();
}

export async function resetBackupMediaDownloadStats(): Promise<void> {
  await DataWriter.resetBackupAttachmentDownloadStats();
  await resetBackupMediaDownloadItems();
}

export async function dismissBackupMediaDownloadBanner(): Promise<void> {
  await itemStorage.put('backupMediaDownloadBannerDismissed', true);
}
