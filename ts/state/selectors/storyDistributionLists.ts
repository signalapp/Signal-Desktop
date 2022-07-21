// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type { StoryDistributionListDataType } from '../ducks/storyDistributionLists';
import type { StoryDistributionListWithMembersDataType } from '../../types/Stories';
import { getConversationSelector } from './conversations';

export const getDistributionLists = (
  state: StateType
): Array<StoryDistributionListDataType> =>
  state.storyDistributionLists.distributionLists.filter(
    list => !list.deletedAtTimestamp
  );

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
      members: list.memberUuids.map(uuid => conversationSelector(uuid)),
    }))
);
