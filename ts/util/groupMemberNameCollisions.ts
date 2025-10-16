// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ReadonlyDeep } from 'type-fest';
import { groupBy, map, filter } from './iterables.std.js';
import { getOwn } from './getOwn.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { isConversationNameKnown } from './isConversationNameKnown.std.js';
import { isInSystemContacts } from './isInSystemContacts.std.js';

const { mapValues, pickBy } = lodash;

export type GroupNameCollisionsWithIdsByTitle = Readonly<
  Record<string, Array<string>>
>;
export type GroupNameCollisionsWithConversationsByTitle = Record<
  string,
  Array<ConversationType>
>;
export type GroupNameCollisionsWithTitlesById = Record<string, string>;

export const dehydrateCollisionsWithConversations = (
  withConversations: Readonly<GroupNameCollisionsWithConversationsByTitle>
): GroupNameCollisionsWithIdsByTitle =>
  mapValues(withConversations, conversations => conversations.map(c => c.id));

export function getCollisionsFromMemberships(
  memberships: Iterable<{ member: ConversationType }>
): GroupNameCollisionsWithConversationsByTitle {
  const members = map(memberships, membership => membership.member);
  const candidateMembers = filter(
    members,
    member => !member.isMe && isConversationNameKnown(member)
  );
  const groupedByTitle = groupBy(candidateMembers, member => member.title);
  // This cast is here because `pickBy` returns a `Partial`, which is incompatible with
  //   `Record`. [This demonstrates the problem][0], but I don't believe it's an actual
  //   issue in the code.
  //
  // Alternatively, we could filter undefined keys or something like that.
  //
  // [0]: https://www.typescriptlang.org/play?#code/C4TwDgpgBAYg9nKBeKAFAhgJ2AS3QGwB4AlCAYzkwBNCBnYTHAOwHMAaKJgVwFsAjCJgB8QgNwAoCk3pQAZgC5YCZFADeUABY5FAVigBfCeNCQoAISwrSFanQbN2nXgOESpMvoouYVs0UA
  return pickBy(
    groupedByTitle,
    group =>
      group.length >= 2 && !group.every(person => isInSystemContacts(person))
  ) as unknown as GroupNameCollisionsWithConversationsByTitle;
}

/**
 * Returns `true` if the user should see a group member name collision warning, and
 * `false` otherwise. Users should see these warnings if any collisions appear that they
 * haven't dismissed.
 */
export const hasUnacknowledgedCollisions = (
  previous: ReadonlyDeep<GroupNameCollisionsWithIdsByTitle>,
  current: ReadonlyDeep<GroupNameCollisionsWithIdsByTitle>
): boolean =>
  Object.entries(current).some(([title, currentIds]) => {
    const previousIds = new Set(getOwn(previous, title) || []);
    return currentIds.some(currentId => !previousIds.has(currentId));
  });

export const invertIdsByTitle = (
  idsByTitle: ReadonlyDeep<GroupNameCollisionsWithIdsByTitle>
): GroupNameCollisionsWithTitlesById => {
  const result: GroupNameCollisionsWithTitlesById = Object.create(null);
  Object.entries(idsByTitle).forEach(([title, ids]) => {
    ids.forEach(id => {
      result[id] = title;
    });
  });
  return result;
};
