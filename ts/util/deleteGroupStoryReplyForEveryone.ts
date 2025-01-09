// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DAY } from './durations';
import { sendDeleteForEveryoneMessage } from './sendDeleteForEveryoneMessage';
import { getMessageById } from '../messages/getMessageById';
import * as log from '../logging/log';

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
      `deleteGroupStoryReplyForEveryone: No conversation model found for: ${messageModel.get(
        'conversationId'
      )}`
    );
    return;
  }

  void sendDeleteForEveryoneMessage(group.attributes, {
    deleteForEveryoneDuration: DAY,
    id: replyMessageId,
    timestamp,
  });
}
