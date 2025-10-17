// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer.preload.js';
import type { StoryDistributionListDataType } from '../ducks/storyDistributionLists.preload.js';
import type { StoryDistributionListWithMembersDataType } from '../../types/Stories.std.js';
import { getConversationSelector } from './conversations.dom.js';
import { MY_STORY_ID } from '../../types/Stories.std.js';

export const getDistributionLists = (
  state: StateType
): Array<StoryDistributionListDataType> =>
  state.storyDistributionLists.distributionLists
    .filter(list => !list.deletedAtTimestamp)
    .sort(list => (list.id === MY_STORY_ID ? -1 : 1));

export const getDistributionListSelector = createSelector(
  getDistributionLists,
  distributionLists => (id: string) =>
    distributionLists.find(list => list.id === id)
);

export const getDistributionListsWithMembers = createSelector(
  getConversationSelector,
  getDistributionLists,
  (
    conversationSelector,
    distributionLists
  ): Array<StoryDistributionListWithMembersDataType> =>
    distributionLists.map(list => ({
      ...list,
      members: list.memberServiceIds.map(serviceId =>
        conversationSelector(serviceId)
      ),
    }))
);
