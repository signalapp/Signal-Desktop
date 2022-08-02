// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import casual from 'casual';

import type { StoryDistributionListDataType } from '../../state/ducks/storyDistributionLists';
import { MY_STORIES_ID } from '../../types/Stories';
import { UUID } from '../../types/UUID';

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
    id: MY_STORIES_ID,
    isBlockList: true,
    memberUuids: [],
    name: MY_STORIES_ID,
  };
}
