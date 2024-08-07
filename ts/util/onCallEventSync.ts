// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallEventSyncEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import {
  peerIdToLog,
  updateCallHistoryFromRemoteEvent,
} from './callDisposition';
import { CallMode } from '../types/CallDisposition';

export async function onCallEventSync(
  syncEvent: CallEventSyncEvent
): Promise<void> {
  const { callEvent, confirm } = syncEvent;
  const { callEventDetails, receivedAtCounter, receivedAtMS } = callEvent;

  if (
    callEventDetails.mode === CallMode.Direct ||
    callEventDetails.mode === CallMode.Group
  ) {
    const { peerId } = callEventDetails;
    const conversation = window.ConversationController.get(peerId);

    if (!conversation) {
      const peerIdLog = peerIdToLog(peerId, callEventDetails.mode);
      log.warn(
        `onCallEventSync: No conversation found for conversationId ${peerIdLog}`
      );
      return;
    }
  }

  await updateCallHistoryFromRemoteEvent(
    callEventDetails,
    receivedAtCounter,
    receivedAtMS
  );
  confirm();
}
