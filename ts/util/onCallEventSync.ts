// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallEventSyncEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import { CallMode } from '../types/Calling';

export async function onCallEventSync(
  syncEvent: CallEventSyncEvent
): Promise<void> {
  const { callEvent, confirm } = syncEvent;
  const {
    peerUuid,
    callId,
    wasIncoming,
    wasVideoCall,
    wasDeclined,
    acceptedTime,
    endedTime,
    receivedAtCounter,
  } = callEvent;

  const conversation = window.ConversationController.get(peerUuid);

  if (!conversation) {
    log.warn(`onCallEventSync: No conversation found for peerUuid ${peerUuid}`);
    return;
  }

  log.info(
    `onCallEventSync: Queuing job to add call history (Call ID: ${callId})`
  );
  await conversation.queueJob('onCallEventSync', async () => {
    await conversation.addCallHistory(
      {
        callId,
        callMode: CallMode.Direct,
        wasDeclined,
        wasIncoming,
        wasVideoCall,
        acceptedTime: acceptedTime ?? undefined,
        endedTime: endedTime ?? undefined,
      },
      receivedAtCounter
    );

    confirm();
  });
}
