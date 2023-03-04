// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { deletePackReference } from '../types/Stickers';
import { isStory } from '../messages/helpers';
import { isDirectConversation } from './whatTypeOfConversation';
import { drop } from './drop';

export async function cleanupMessage(
  message: MessageAttributesType
): Promise<void> {
  const { id, conversationId } = message;

  window.reduxActions?.conversations.messageDeleted(id, conversationId);

  const parentConversation = window.ConversationController.get(conversationId);
  parentConversation?.debouncedUpdateLastMessage?.();

  window.MessageController.unregister(id);

  await deleteMessageData(message);

  const isGroupConversation = Boolean(
    parentConversation && !isDirectConversation(parentConversation.attributes)
  );

  if (isStory(message)) {
    await cleanupStoryReplies(conversationId, id, isGroupConversation);
  }
}

async function cleanupStoryReplies(
  conversationId: string,
  storyId: string,
  isGroupConversation: boolean,
  pagination?: {
    messageId: string;
    receivedAt: number;
  }
): Promise<void> {
  const { messageId, receivedAt } = pagination || {};

  const replies = await window.Signal.Data.getOlderMessagesByConversation({
    conversationId,
    includeStoryReplies: false,
    messageId,
    receivedAt,
    storyId,
  });

  if (!replies.length) {
    return;
  }

  const lastMessage = replies[replies.length - 1];
  const lastMessageId = lastMessage.id;
  const lastReceivedAt = lastMessage.received_at;

  if (messageId === lastMessageId) {
    return;
  }

  if (isGroupConversation) {
    // Cleanup all group replies
    await Promise.all(
      replies.map(reply => {
        const replyMessageModel = window.MessageController.register(
          reply.id,
          reply
        );
        return replyMessageModel.eraseContents();
      })
    );
  } else {
    // Refresh the storyReplyContext data for 1:1 conversations
    replies.forEach(reply => {
      const model = window.MessageController.register(reply.id, reply);
      model.unset('storyReplyContext');
      drop(model.hydrateStoryContext());
    });
  }

  return cleanupStoryReplies(conversationId, storyId, isGroupConversation, {
    messageId: lastMessageId,
    receivedAt: lastReceivedAt,
  });
}

export async function deleteMessageData(
  message: MessageAttributesType
): Promise<void> {
  await window.Signal.Migrations.deleteExternalMessageFiles(message);

  if (isStory(message)) {
    const { id, conversationId } = message;
    const parentConversation =
      window.ConversationController.get(conversationId);
    const isGroupConversation = Boolean(
      parentConversation && !isDirectConversation(parentConversation.attributes)
    );
    await cleanupStoryReplies(conversationId, id, isGroupConversation);
  }

  const { sticker } = message;
  if (!sticker) {
    return;
  }

  const { packId } = sticker;
  if (packId) {
    await deletePackReference(message.id, packId);
  }
}
