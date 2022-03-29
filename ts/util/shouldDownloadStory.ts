// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';

import dataInterface from '../sql/Client';

const MAX_NUM_STORIES_TO_PREFETCH = 5;

export async function shouldDownloadStory(
  conversation: ConversationAttributesType
): Promise<boolean> {
  if (!conversation.hasPostedStory) {
    return true;
  }

  const [storyReads, storyCounts] = await Promise.all([
    dataInterface.countStoryReadsByConversation(conversation.id),
    dataInterface.getStoryCount(conversation.id),
  ]);

  return storyReads > 0 && storyCounts <= MAX_NUM_STORIES_TO_PREFETCH;
}
