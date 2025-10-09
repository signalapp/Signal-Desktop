// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import type { Backups, SignalService } from '../protobuf/index.js';
import * as Bytes from '../Bytes.js';
import { backupsService } from '../services/backups/index.js';
import { drop } from './drop.js';
import { createLogger } from '../logging/log.js';
import { resetBackupMediaDownloadStats } from './backupMediaDownload.js';
import { itemStorage } from '../textsecure/Storage.js';

const log = createLogger('BackupSubscriptionData');

// These two proto messages (Backups.AccountData.IIAPSubscriberData &&
// SignalService.AccountRecord.IIAPSubscriberData) should remain in sync. If they drift,
// we'll need separate logic for each
export async function saveBackupsSubscriberData(
  backupsSubscriberData:
    | Backups.AccountData.IIAPSubscriberData
    | SignalService.AccountRecord.IIAPSubscriberData
    | null
    | undefined
): Promise<void> {
  const previousSubscriberId = itemStorage.get('backupsSubscriberId');

  if (previousSubscriberId !== backupsSubscriberData?.subscriberId) {
    drop(backupsService.refreshBackupAndSubscriptionStatus());
  }

  if (backupsSubscriberData == null) {
    await itemStorage.remove('backupsSubscriberId');
    await itemStorage.remove('backupsSubscriberPurchaseToken');
    await itemStorage.remove('backupsSubscriberOriginalTransactionId');
    return;
  }

  const { subscriberId, purchaseToken, originalTransactionId } =
    backupsSubscriberData;

  if (Bytes.isNotEmpty(subscriberId)) {
    await itemStorage.put('backupsSubscriberId', subscriberId);
  } else {
    await itemStorage.remove('backupsSubscriberId');
  }

  if (purchaseToken) {
    await itemStorage.put('backupsSubscriberPurchaseToken', purchaseToken);
  } else {
    await itemStorage.remove('backupsSubscriberPurchaseToken');
  }

  if (originalTransactionId) {
    await itemStorage.put(
      'backupsSubscriberOriginalTransactionId',
      originalTransactionId.toString()
    );
  } else {
    await itemStorage.remove('backupsSubscriberOriginalTransactionId');
  }
}

export async function saveBackupTier(
  backupTier: number | undefined
): Promise<void> {
  const previousBackupTier = itemStorage.get('backupTier');
  await itemStorage.put('backupTier', backupTier);
  if (backupTier !== previousBackupTier) {
    log.info('backup tier has changed', { previousBackupTier, backupTier });
    await resetBackupMediaDownloadStats();
    drop(backupsService.resetCachedData());
  }
}

export function generateBackupsSubscriberData(): Backups.AccountData.IIAPSubscriberData | null {
  const backupsSubscriberId = itemStorage.get('backupsSubscriberId');

  if (Bytes.isEmpty(backupsSubscriberId)) {
    return null;
  }

  const backupsSubscriberData: Backups.AccountData.IIAPSubscriberData = {
    subscriberId: backupsSubscriberId,
  };
  const purchaseToken = itemStorage.get('backupsSubscriberPurchaseToken');
  if (purchaseToken) {
    backupsSubscriberData.purchaseToken = purchaseToken;
  } else {
    const originalTransactionId = itemStorage.get(
      'backupsSubscriberOriginalTransactionId'
    );
    if (originalTransactionId) {
      backupsSubscriberData.originalTransactionId = Long.fromString(
        originalTransactionId
      );
    }
  }

  return backupsSubscriberData;
}
