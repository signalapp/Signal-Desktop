// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import casual from 'casual';
import { v4 as generateUuid } from 'uuid';

import type { AttachmentType } from '../../types/Attachment';
import type { ConversationType } from '../../state/ducks/conversations';
import type {
  ConversationStoryType,
  MyStoryType,
  StoryViewType,
} from '../../types/Stories';
import * as durations from '../../util/durations';
import { getDefaultConversation } from './getDefaultConversation';
import { fakeAttachment, fakeThumbnail } from './fakeAttachment';
import { MY_STORY_ID, ResolvedSendStatus } from '../../types/Stories';

function getAttachmentWithThumbnail(url: string): AttachmentType {
  return fakeAttachment({
    path: url,
    thumbnail: fakeThumbnail(url),
    url,
  });
}

export function getFakeMyStory(id?: string, name?: string): MyStoryType {
  const storyCount = casual.integer(2, 6);

  return {
    id: id || generateUuid(),
    name: name || id === MY_STORY_ID ? 'My Stories' : casual.catch_phrase,
    reducedSendStatus: ResolvedSendStatus.Sent,
    stories: Array.from(Array(storyCount), () => ({
      ...getFakeStoryView(),
      sendState: [],
      views: casual.integer(1, 20),
    })),
  };
}

export function getFakeStoryView(
  attachmentUrl?: string,
  timestamp?: number
): StoryViewType {
  const sender = getDefaultConversation();

  const messageId = generateUuid();

  return {
    attachment: getAttachmentWithThumbnail(
      attachmentUrl || '/fixtures/tina-rolf-269345-unsplash.jpg'
    ),
    isUnread: Boolean(casual.coin_flip),
    messageId,
    messageIdForLogging: `${messageId} (for logging)`,
    sender,
    timestamp: timestamp || Date.now() - 2 * durations.MINUTE,
    expirationTimestamp: undefined,
  };
}

export function getFakeStory({
  attachmentUrl,
  group,
  timestamp,
}: {
  attachmentUrl?: string;
  group?: ConversationType;
  timestamp?: number;
}): ConversationStoryType {
  const storyView = getFakeStoryView(attachmentUrl, timestamp);

  const hasReplies = group ? Boolean(casual.coin_flip) : false;
  const hasRepliesFromSelf =
    group && hasReplies ? Boolean(casual.coin_flip) : false;

  return {
    conversationId: storyView.sender.id,
    hasReplies,
    hasRepliesFromSelf,
    group,
    storyView,
  };
}
