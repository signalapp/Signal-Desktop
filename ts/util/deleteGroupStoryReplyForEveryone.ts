// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DAY } from './durations/index.js';
import { sendDeleteForEveryoneMessage } from './sendDeleteForEveryoneMessage.js';
import { getMessageById } from '../messages/getMessageById.js';
import { createLogger } from '../logging/log.js';

const log = createLogger('deleteGroupStoryReplyForEveryone');

export async function deleteGroupStoryReplyForEveryone(
  replyMessageId: string
): Promise<void> {
  const messageModel = await getMessageById(replyMessageId);

  if (!messageModel) {
    log.warn(
      `deleteStoryReplyForEveryone: No message model found for reply: ${replyMessageId}`
    );
    return;
  }

  const timestamp = messageModel.get('timestamp');

  const group = window.ConversationController.get(
    messageModel.get('conversationId')
  );

  if (!group) {
    log.warn(
      `No conversation model found for: ${messageModel.get('conversationId')}`
    );
    return;
  }

  void sendDeleteForEveryoneMessage(group.attributes, {
    deleteForEveryoneDuration: DAY,
    id: replyMessageId,
    timestamp,
  });
}
