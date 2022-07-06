// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as uuid } from 'uuid';

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
import { MY_STORIES_ID } from '../../types/Stories';

function getAttachmentWithThumbnail(url: string): AttachmentType {
  return fakeAttachment({
    url,
    thumbnail: fakeThumbnail(url),
  });
}

export function getFakeMyStory(id?: string, name?: string): MyStoryType {
  const storyCount = Math.ceil(Math.random() * 6 + 1);

  return {
    distributionId: id || uuid(),
    distributionName:
      name || id === MY_STORIES_ID ? 'My Stories' : 'Private Distribution List',
    stories: Array.from(Array(storyCount), () => ({
      ...getFakeStoryView(),
      sendState: [],
      views: Math.floor(Math.random() * 20),
    })),
  };
}

export function getFakeStoryView(
  attachmentUrl?: string,
  timestamp?: number
): StoryViewType {
  const sender = getDefaultConversation();

  return {
    attachment: getAttachmentWithThumbnail(
      attachmentUrl || '/fixtures/tina-rolf-269345-unsplash.jpg'
    ),
    hasReplies: Math.random() > 0.5,
    isUnread: Math.random() > 0.5,
    messageId: uuid(),
    sender,
    timestamp: timestamp || Date.now() - 2 * durations.MINUTE,
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

  return {
    conversationId: storyView.sender.id,
    group,
    storyView,
  };
}
