// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Backups, SignalService } from '../protobuf/index.std.js';
import * as Bytes from '../Bytes.std.js';
import { backupsService } from '../services/backups/index.preload.js';
import { drop } from './drop.std.js';
import { createLogger } from '../logging/log.std.js';
import { resetBackupMediaDownloadStats } from './backupMediaDownload.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('BackupSubscriptionData');

// These two proto messages (Backups.AccountData.IIAPSubscriberData &&
// SignalService.AccountRecord.IIAPSubscriberData) should remain in sync. If they drift,
// we'll need separate logic for each
export async function saveBackupsSubscriberData(
  backupsSubscriberData:
    | Backups.AccountData.IAPSubscriberData.Params
    | SignalService.AccountRecord.IAPSubscriberData.Params
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

  const { subscriberId, iapSubscriptionId } = backupsSubscriberData;

  if (Bytes.isNotEmpty(subscriberId)) {
    await itemStorage.put('backupsSubscriberId', subscriberId);
  } else {
    await itemStorage.remove('backupsSubscriberId');
  }

  if (iapSubscriptionId?.purchaseToken != null) {
    await itemStorage.put(
      'backupsSubscriberPurchaseToken',
      iapSubscriptionId.purchaseToken
    );
  } else {
    await itemStorage.remove('backupsSubscriberPurchaseToken');
  }

  if (iapSubscriptionId?.originalTransactionId != null) {
    await itemStorage.put(
      'backupsSubscriberOriginalTransactionId',
      iapSubscriptionId.originalTransactionId.toString()
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

export function generateBackupsSubscriberData(): Backups.AccountData.IAPSubscriberData.Params | null {
  const subscriberId = itemStorage.get('backupsSubscriberId') ?? null;

  if (Bytes.isEmpty(subscriberId)) {
    return null;
  }

  let backupsSubscriberData: Backups.AccountData.IAPSubscriberData.Params;
  const purchaseToken = itemStorage.get('backupsSubscriberPurchaseToken');
  if (purchaseToken) {
    backupsSubscriberData = {
      subscriberId,
      iapSubscriptionId: {
        purchaseToken,
      },
    };
  } else {
    const originalTransactionId = itemStorage.get(
      'backupsSubscriberOriginalTransactionId'
    );
    if (originalTransactionId != null) {
      backupsSubscriberData = {
        subscriberId,
        iapSubscriptionId: {
          originalTransactionId: BigInt(originalTransactionId),
        },
      };
    } else {
      backupsSubscriberData = {
        subscriberId,
        iapSubscriptionId: null,
      };
    }
  }

  return backupsSubscriberData;
}
