// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SignalService as Proto } from '../protobuf';
import { normalizeUuid } from '../util/normalizeUuid';
import type {
  ProcessedUnidentifiedDeliveryStatus,
  ProcessedSent,
  ProcessedSyncMessage,
} from './Types.d';

import UnidentifiedDeliveryStatus = Proto.SyncMessage.Sent.IUnidentifiedDeliveryStatus;

function processUnidentifiedDeliveryStatus(
  status: UnidentifiedDeliveryStatus
): ProcessedUnidentifiedDeliveryStatus {
  const { destinationUuid } = status;

  return {
    ...status,

    destinationUuid: destinationUuid
      ? normalizeUuid(
          destinationUuid,
          'syncMessage.sent.unidentifiedStatus.destinationUuid'
        )
      : undefined,
  };
}

function processSent(
  sent?: Proto.SyncMessage.ISent | null
): ProcessedSent | undefined {
  if (!sent) {
    return undefined;
  }

  const { destinationUuid, unidentifiedStatus } = sent;

  return {
    ...sent,

    destinationUuid: destinationUuid
      ? normalizeUuid(destinationUuid, 'syncMessage.sent.destinationUuid')
      : undefined,

    unidentifiedStatus: unidentifiedStatus
      ? unidentifiedStatus.map(processUnidentifiedDeliveryStatus)
      : undefined,
  };
}

export function processSyncMessage(
  syncMessage: Proto.ISyncMessage
): ProcessedSyncMessage {
  return {
    ...syncMessage,
    sent: processSent(syncMessage.sent),
  };
}
