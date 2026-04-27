// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import casual from 'casual';

import type { StoryDistributionListDataType } from '../state/ducks/storyDistributionLists.preload.ts';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories.std.ts';
import { MY_STORY_ID } from '../types/Stories.std.ts';
import { generateStoryDistributionId } from '../types/StoryDistributionId.std.ts';
import { getDefaultConversation } from './getDefaultConversation.std.ts';
import { generateAci } from './serviceIdUtils.std.ts';

export function getFakeDistributionListsWithMembers(): Array<StoryDistributionListWithMembersDataType> {
  return [
    {
      ...getMyStories(),
      members: [],
    },
    ...Array.from(Array(casual.integer(2, 8)), () => ({
      ...getFakeDistributionList(),
      members: Array.from(Array(casual.integer(3, 12)), () =>
        getDefaultConversation()
      ),
    })),
  ];
}

export function getFakeDistributionLists(): Array<StoryDistributionListDataType> {
  return [
    getMyStories(),
    ...Array.from(Array(casual.integer(2, 8)), getFakeDistributionList),
  ];
}

export function getFakeDistributionList(): StoryDistributionListDataType {
  return {
    allowsReplies: Boolean(casual.coin_flip),
    id: generateStoryDistributionId(),
    isBlockList: false,
    memberServiceIds: Array.from(Array(casual.integer(3, 12)), () =>
      generateAci()
    ),
    name: casual.title,
  };
}

export function getMyStories(): StoryDistributionListDataType {
  return {
    allowsReplies: true,
    id: MY_STORY_ID,
    isBlockList: true,
    memberServiceIds: [],
    name: MY_STORY_ID,
  };
}
