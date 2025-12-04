// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../../types/ServiceId.std.js';
import { getAuthorId } from '../../messages/sources.preload.js';
import type { ConversationModel } from '../../models/conversations.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import type { MessageModel } from '../../models/messages.preload.js';

export type MessageModifierTarget = Readonly<{
  targetMessage: MessageModel;
  targetConversation: ConversationModel;
}>;

export async function findMessageModifierTarget(
  targetSentTimestamp: number,
  targetAuthorAci: AciString
): Promise<MessageModifierTarget | null> {
  const authorConversation = window.ConversationController.lookupOrCreate({
    serviceId: targetAuthorAci,
    reason: 'findTargetMessageBySentAtAndAuthorAci',
  });

  if (authorConversation == null) {
    return null;
  }

  const targetMessage = await window.MessageCache.findBySentAt(
    targetSentTimestamp,
    message => {
      return getAuthorId(message.attributes) === authorConversation.id;
    }
  );

  if (targetMessage == null) {
    return null;
  }

  const targetConversation = window.ConversationController.get(
    targetMessage.get('conversationId')
  );
  strictAssert(targetConversation, 'Missing conversation for target message');

  return { targetMessage, targetConversation };
}
