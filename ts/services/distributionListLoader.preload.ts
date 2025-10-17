// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.js';
import type { StoryDistributionWithMembersType } from '../sql/Interface.std.js';
import type { StoryDistributionListDataType } from '../state/ducks/storyDistributionLists.preload.js';
import { strictAssert } from '../util/assert.std.js';

let distributionLists: Array<StoryDistributionWithMembersType> | undefined;

export async function loadDistributionLists(): Promise<void> {
  distributionLists = await DataReader.getAllStoryDistributionsWithMembers();
}

export function getDistributionListsForRedux(): Array<StoryDistributionListDataType> {
  strictAssert(distributionLists, 'distributionLists has not been loaded');

  const lists = distributionLists
    .map(list => ({
      allowsReplies: Boolean(list.allowsReplies),
      deletedAtTimestamp: list.deletedAtTimestamp,
      id: list.id,
      isBlockList: Boolean(list.isBlockList),
      name: list.name,
      memberServiceIds: list.members,
    }))
    .filter(list => !list.deletedAtTimestamp);

  distributionLists = undefined;

  return lists;
}
