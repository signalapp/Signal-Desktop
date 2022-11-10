// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import casual from 'casual';

import type { StoryDistributionListDataType } from '../../state/ducks/storyDistributionLists';
import type { StoryDistributionListWithMembersDataType } from '../../types/Stories';
import { MY_STORY_ID } from '../../types/Stories';
import { UUID } from '../../types/UUID';
import { getDefaultConversation } from './getDefaultConversation';

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
    id: UUID.generate().toString(),
    isBlockList: false,
    memberUuids: Array.from(Array(casual.integer(3, 12)), () =>
      UUID.generate().toString()
    ),
    name: casual.title,
  };
}

export function getMyStories(): StoryDistributionListDataType {
  return {
    allowsReplies: true,
    id: MY_STORY_ID,
    isBlockList: true,
    memberUuids: [],
    name: MY_STORY_ID,
  };
}
