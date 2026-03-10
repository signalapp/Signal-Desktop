// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import { isIncoming, isOutgoing } from '../messages/helpers.std.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import {
  isSent,
  isViewed,
  isMessageJustForMe,
  getHighestSuccessfulRecipientStatus,
} from '../messages/MessageSendState.std.js';

export function isVoiceMessagePlayed(
  message: Pick<
    ReadonlyMessageAttributesType,
    'type' | 'isErased' | 'errors' | 'readStatus' | 'sendStateByConversationId'
  >,
  ourConversationId: string | undefined
): boolean {
  if (message.isErased) {
    return false;
  }

  if (message.errors != null && message.errors.length > 0) {
    return false;
  }

  if (isIncoming(message)) {
    return message.readStatus === ReadStatus.Viewed;
  }

  if (isOutgoing(message)) {
    const { sendStateByConversationId = {} } = message;

    if (isMessageJustForMe(sendStateByConversationId, ourConversationId)) {
      return isSent(
        getHighestSuccessfulRecipientStatus(
          sendStateByConversationId,
          undefined
        )
      );
    }

    return isViewed(
      getHighestSuccessfulRecipientStatus(
        sendStateByConversationId,
        ourConversationId
      )
    );
  }

  return false;
}
