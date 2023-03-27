// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations';
import type { UUID } from '../types/UUID';
import type { MessageModel } from '../models/messages';
import * as log from '../logging/log';
import dataInterface from '../sql/Client';
import { isGroup } from './whatTypeOfConversation';
import { isMessageUnread } from './isMessageUnread';

function isSameUuid(
  a: UUID | string | null | undefined,
  b: UUID | string | null | undefined
): boolean {
  return a != null && b != null && String(a) === String(b);
}

export async function shouldReplyNotifyUser(
  message: MessageModel,
  conversation: ConversationModel
): Promise<boolean> {
  // Don't notify if the message has already been read
  if (!isMessageUnread(message.attributes)) {
    return false;
  }

  const storyId = message.get('storyId');

  // If this is not a reply to a story, always notify.
  if (storyId == null) {
    return true;
  }

  // Always notify if this is not a group
  if (!isGroup(conversation.attributes)) {
    return true;
  }

  const matchedStory = window.reduxStore
    .getState()
    .stories.stories.find(story => {
      return story.messageId === storyId;
    });

  // If we can't find the story, don't notify
  if (matchedStory == null) {
    log.warn("Couldn't find story for reply");
    return false;
  }

  const currentUserId = window.textsecure.storage.user.getUuid();
  const storySourceId = matchedStory.sourceUuid;

  const currentUserIdSource = isSameUuid(storySourceId, currentUserId);

  // If the story is from the current user, always notify
  if (currentUserIdSource) {
    return true;
  }

  // If the story is from a different user, only notify if the user has
  // replied or reacted to the story

  const replies = await dataInterface.getOlderMessagesByConversation({
    conversationId: conversation.id,
    limit: 9000,
    storyId,
    includeStoryReplies: true,
  });

  const prevCurrentUserReply = replies.find(replyMessage => {
    return replyMessage.type === 'outgoing';
  });

  if (prevCurrentUserReply != null) {
    return true;
  }

  // Otherwise don't notify
  return false;
}
