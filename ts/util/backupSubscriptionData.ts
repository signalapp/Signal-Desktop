// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import type { Backups, SignalService } from '../protobuf';
import * as Bytes from '../Bytes';

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
  if (backupsSubscriberData == null) {
    await window.storage.remove('backupsSubscriberId');
    await window.storage.remove('backupsSubscriberPurchaseToken');
    await window.storage.remove('backupsSubscriberOriginalTransactionId');
    return;
  }

  const { subscriberId, purchaseToken, originalTransactionId } =
    backupsSubscriberData;

  if (Bytes.isNotEmpty(subscriberId)) {
    await window.storage.put('backupsSubscriberId', subscriberId);
  } else {
    await window.storage.remove('backupsSubscriberId');
  }

  if (purchaseToken) {
    await window.storage.put('backupsSubscriberPurchaseToken', purchaseToken);
  } else {
    await window.storage.remove('backupsSubscriberPurchaseToken');
  }

  if (originalTransactionId) {
    await window.storage.put(
      'backupsSubscriberOriginalTransactionId',
      originalTransactionId.toString()
    );
  } else {
    await window.storage.remove('backupsSubscriberOriginalTransactionId');
  }
}

export function generateBackupsSubscriberData(): Backups.AccountData.IIAPSubscriberData | null {
  const backupsSubscriberId = window.storage.get('backupsSubscriberId');

  if (Bytes.isEmpty(backupsSubscriberId)) {
    return null;
  }

  const backupsSubscriberData: Backups.AccountData.IIAPSubscriberData = {
    subscriberId: backupsSubscriberId,
  };
  const purchaseToken = window.storage.get('backupsSubscriberPurchaseToken');
  if (purchaseToken) {
    backupsSubscriberData.purchaseToken = purchaseToken;
  } else {
    const originalTransactionId = window.storage.get(
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
