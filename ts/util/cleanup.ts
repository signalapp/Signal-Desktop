// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { deletePackReference } from '../types/Stickers';
import { isStory } from '../messages/helpers';

export async function cleanupMessage(
  message: MessageAttributesType
): Promise<void> {
  const { id, conversationId } = message;

  window.reduxActions?.conversations.messageDeleted(id, conversationId);

  const parentConversation = window.ConversationController.get(conversationId);
  parentConversation?.debouncedUpdateLastMessage?.();

  window.MessageController.unregister(id);

  await deleteMessageData(message);

  if (isStory(message)) {
    await fixupStoryReplies(conversationId, id);
  }
}

async function fixupStoryReplies(
  conversationId: string,
  storyId: string,
  pagination?: {
    messageId: string;
    receivedAt: number;
  }
): Promise<void> {
  const { messageId, receivedAt } = pagination || {};

  const replies = await window.Signal.Data.getOlderMessagesByConversation(
    conversationId,
    {
      includeStoryReplies: false,
      receivedAt,
      storyId,
    }
  );

  if (!replies.length) {
    return;
  }

  const lastMessage = replies[replies.length - 1];
  const lastMessageId = lastMessage.id;
  const lastReceivedAt = lastMessage.received_at;

  if (messageId === lastMessageId) {
    return;
  }

  replies.forEach(reply => {
    const model = window.MessageController.register(reply.id, reply);
    model.unset('storyReplyContext');
    model.hydrateStoryContext(null);
  });

  return fixupStoryReplies(conversationId, storyId, {
    messageId: lastMessageId,
    receivedAt: lastReceivedAt,
  });
}

export async function deleteMessageData(
  message: MessageAttributesType
): Promise<void> {
  await window.Signal.Migrations.deleteExternalMessageFiles(message);

  const { sticker } = message;
  if (!sticker) {
    return;
  }

  const { packId } = sticker;
  if (packId) {
    await deletePackReference(message.id, packId);
  }
}
