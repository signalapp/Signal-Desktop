// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { deletePackReference } from '../types/Stickers';
import { isStory } from '../messages/helpers';
import { isDirectConversation } from './whatTypeOfConversation';
import * as log from '../logging/log';

export async function cleanupMessage(
  message: MessageAttributesType
): Promise<void> {
  cleanupMessageFromMemory(message);
  await deleteMessageData(message);
}

/** Removes a message from redux caches & backbone, but does NOT delete files on disk,
 * story replies, edit histories, attachments, etc. Should ONLY be called in conjunction
 * with deleteMessageData.  */
export function cleanupMessageFromMemory(message: MessageAttributesType): void {
  const { id, conversationId } = message;

  window.reduxActions?.conversations.messageDeleted(id, conversationId);

  const parentConversation = window.ConversationController.get(conversationId);
  parentConversation?.debouncedUpdateLastMessage();

  window.MessageCache.__DEPRECATED$unregister(id);
}

async function cleanupStoryReplies(
  story: MessageAttributesType,
  pagination?: {
    messageId: string;
    receivedAt: number;
  }
): Promise<void> {
  const storyId = story.id;
  const parentConversation = window.ConversationController.get(
    story.conversationId
  );
  const isGroupConversation = Boolean(
    parentConversation && !isDirectConversation(parentConversation.attributes)
  );

  const replies = await window.Signal.Data.getRecentStoryReplies(
    storyId,
    pagination
  );

  const logId = `cleanupStoryReplies(${storyId}/isGroup=${isGroupConversation})`;
  const lastMessage = replies[replies.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastReceivedAt = lastMessage?.received_at;

  log.info(
    `${logId}: Cleaning ${replies.length} replies, ending with message ${lastMessageId}`
  );

  if (!replies.length) {
    return;
  }

  if (pagination?.messageId === lastMessageId) {
    log.info(
      `${logId}: Returning early; last message id is pagination starting id`
    );
    return;
  }

  if (isGroupConversation) {
    // Cleanup all group replies
    await Promise.all(
      replies.map(reply => {
        const replyMessageModel = window.MessageCache.__DEPRECATED$register(
          reply.id,
          reply,
          'cleanupStoryReplies/group'
        );
        return replyMessageModel.eraseContents();
      })
    );
  } else {
    // Refresh the storyReplyContext data for 1:1 conversations
    await Promise.all(
      replies.map(async reply => {
        const model = window.MessageCache.__DEPRECATED$register(
          reply.id,
          reply,
          'cleanupStoryReplies/1:1'
        );
        model.set('storyReplyContext', undefined);
        await model.hydrateStoryContext(story, { shouldSave: true });
      })
    );
  }

  return cleanupStoryReplies(story, {
    messageId: lastMessageId,
    receivedAt: lastReceivedAt,
  });
}

export async function deleteMessageData(
  message: MessageAttributesType
): Promise<void> {
  await window.Signal.Migrations.deleteExternalMessageFiles(message);

  if (isStory(message)) {
    // Attachments have been deleted from disk; remove from memory before replies update
    const storyWithoutAttachments = { ...message, attachments: undefined };
    await cleanupStoryReplies(storyWithoutAttachments);
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
