// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallEventSyncEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import { updateCallHistoryFromRemoteEvent } from './callDisposition';

export async function onCallEventSync(
  syncEvent: CallEventSyncEvent
): Promise<void> {
  const { callEvent, confirm } = syncEvent;
  const { callEventDetails, receivedAtCounter } = callEvent;
  const { peerId } = callEventDetails;

  const conversation = window.ConversationController.get(peerId);

  if (!conversation) {
    log.warn(
      `onCallEventSync: No conversation found for conversationId ${peerId}`
    );
    return;
  }

  await updateCallHistoryFromRemoteEvent(callEventDetails, receivedAtCounter);
  confirm();
}
