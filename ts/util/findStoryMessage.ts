// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ReadonlyMessageAttributesType,
  MessageAttributesType,
} from '../model-types.d';
import { type AciString } from '../types/ServiceId';
import { type ProcessedStoryContext } from '../textsecure/Types.d';
import { DataReader } from '../sql/Client';
import { createLogger } from '../logging/log';
import { getAuthorId } from '../messages/helpers';

const log = createLogger('findStoryMessage');

export async function findStoryMessages(
  conversationId: string,
  storyContext?: ProcessedStoryContext
): Promise<Array<MessageAttributesType>> {
  if (!storyContext) {
    return [];
  }

  const { authorAci, sentTimestamp: sentAt } = storyContext;

  if (!sentAt) {
    return [];
  }

  if (authorAci == null) {
    return [];
  }

  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();

  const messages = await DataReader.getMessagesBySentAt(sentAt);
  const found = messages.filter(item =>
    isStoryAMatch(item, conversationId, ourConversationId, authorAci, sentAt)
  );

  if (found.length === 0) {
    log.info('findStoryMessages: message not found', sentAt);
    return [];
  }

  return found;
}

function isStoryAMatch(
  message: ReadonlyMessageAttributesType | null | undefined,
  conversationId: string,
  ourConversationId: string,
  authorAci: AciString,
  sentTimestamp: number
): boolean {
  if (!message) {
    return false;
  }

  const authorConversation = window.ConversationController.lookupOrCreate({
    e164: undefined,
    serviceId: authorAci,
    reason: 'isStoryAMatch',
  });

  return (
    message.sent_at === sentTimestamp &&
    getAuthorId(message) === authorConversation?.id &&
    (message.conversationId === conversationId ||
      message.conversationId === ourConversationId)
  );
}
