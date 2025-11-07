// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ReadonlyMessageAttributesType,
  ConversationAttributesType,
} from '../model-types.d.ts';
import { type AciString } from '../types/ServiceId.std.js';
import type { ProcessedStoryContext } from '../textsecure/Types.d.ts';
import { createLogger } from '../logging/log.std.js';
import { getAuthorId } from '../messages/sources.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { isDirectConversation } from './whatTypeOfConversation.dom.js';

const log = createLogger('findStoryMessage');

export type FindStoryMessageOptionsType = Readonly<{
  conversation: ConversationAttributesType;
  senderId: string;
  storyContext?: ProcessedStoryContext;
}>;

export async function findStoryMessage({
  conversation,
  senderId,
  storyContext,
}: FindStoryMessageOptionsType): Promise<
  ReadonlyMessageAttributesType | undefined
> {
  if (!storyContext) {
    return undefined;
  }

  const { authorAci, sentTimestamp: sentAt } = storyContext;

  if (!sentAt) {
    return undefined;
  }

  if (authorAci == null) {
    return undefined;
  }

  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();
  const ourAci = itemStorage.user.getCheckedAci();

  const found = await window.MessageCache.findBySentAt(
    sentAt,
    ({ attributes: candidate }) => {
      if (
        !isStoryAMatch(
          candidate,
          conversation.id,
          ourConversationId,
          authorAci,
          sentAt
        )
      ) {
        return false;
      }

      const sendStateByConversationId =
        candidate.sendStateByConversationId || {};
      const sendState = sendStateByConversationId[senderId];

      const storyQuoteIsFromSelf = candidate.sourceServiceId === ourAci;

      if (!storyQuoteIsFromSelf) {
        return true;
      }

      // The sender is not a recipient for this story
      if (sendState === undefined) {
        return false;
      }

      // Group replies are always allowed
      if (!isDirectConversation(conversation)) {
        return true;
      }

      // For 1:1 stories, we need to check if they can be replied to
      return sendState.isAllowedToReplyToStory !== false;
    }
  );

  if (found == null) {
    log.info('findStoryMessages: message not found', sentAt);
    return undefined;
  }

  return found.attributes;
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
