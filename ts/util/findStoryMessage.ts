// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import type { MessageModel } from '../models/messages';
import type { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import { find } from './iterables';
import { getContactId } from '../messages/helpers';
import { getTimestampFromLong } from './timestampLongUtils';

export async function findStoryMessage(
  conversationId: string,
  storyContext?: Proto.DataMessage.IStoryContext
): Promise<MessageModel | undefined> {
  if (!storyContext) {
    return;
  }

  const { authorUuid, sentTimestamp } = storyContext;

  if (!authorUuid || !sentTimestamp) {
    return;
  }

  const sentAt = getTimestampFromLong(sentTimestamp);

  const inMemoryMessages = window.MessageController.filterBySentAt(sentAt);
  const matchingMessage = find(inMemoryMessages, item =>
    isStoryAMatch(item.attributes, conversationId, authorUuid, sentAt)
  );

  if (matchingMessage) {
    return matchingMessage;
  }

  log.info('findStoryMessage: db lookup needed', sentAt);
  const messages = await window.Signal.Data.getMessagesBySentAt(sentAt);
  const found = messages.find(item =>
    isStoryAMatch(item, conversationId, authorUuid, sentAt)
  );

  if (!found) {
    log.info('findStoryMessage: message not found', sentAt);
    return;
  }

  const message = window.MessageController.register(found.id, found);
  return message;
}

export function isStoryAMatch(
  message: MessageAttributesType | null | undefined,
  conversationId: string,
  authorUuid: string,
  sentTimestamp: number
): message is MessageAttributesType {
  if (!message) {
    return false;
  }

  const authorConversationId = window.ConversationController.ensureContactIds({
    e164: undefined,
    uuid: authorUuid,
  });

  return (
    message.sent_at === sentTimestamp &&
    message.conversationId === conversationId &&
    getContactId(message) === authorConversationId
  );
}
