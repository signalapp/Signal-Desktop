// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type { StoryDistributionListDataType } from '../ducks/storyDistributionLists';

const getDistributionLists = (
  state: StateType
): Array<StoryDistributionListDataType> =>
  state.storyDistributionLists.distributionLists;

export const getDistributionListSelector = createSelector(
  getDistributionLists,
  distributionLists => (id: string) =>
    distributionLists.find(list => list.id === id)
);
