// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';

import type { ConversationType } from '../state/ducks/conversations';
import { parseAndFormatPhoneNumber } from './libphonenumberInstance';
import { WEEK } from './durations';

// Fuse.js scores have order of 0.01
const ACTIVE_AT_SCORE_FACTOR = (1 / WEEK) * 0.01;
const LEFT_GROUP_PENALTY = 1;

const FUSE_OPTIONS: Fuse.IFuseOptions<ConversationType> = {
  // A small-but-nonzero threshold lets us match parts of E164s better, and makes the
  //   search a little more forgiving.
  threshold: 0.2,
  includeScore: true,
  useExtendedSearch: true,
  // We sort manually anyway
  shouldSort: true,
  // the default of 100 is not enough to catch a word at the end of a convo/group title
  // 150 is about right
  distance: 150,
  keys: [
    {
      name: 'searchableTitle',
      weight: 1,
    },
    {
      name: 'title',
      weight: 1,
    },
    {
      name: 'name',
      weight: 1,
    },
    {
      name: 'username',
      weight: 1,
    },
    {
      name: 'e164',
      weight: 0.5,
    },
  ],
};

const cachedIndices = new WeakMap<
  ReadonlyArray<ConversationType>,
  Fuse<ConversationType>
>();

type CommandRunnerType = (
  conversations: ReadonlyArray<ConversationType>,
  query: string
) => Array<ConversationType>;

const COMMANDS = new Map<string, CommandRunnerType>();

COMMANDS.set('uuidEndsWith', (conversations, query) => {
  return conversations.filter(convo => convo.uuid?.endsWith(query));
});

COMMANDS.set('idEndsWith', (conversations, query) => {
  return conversations.filter(convo => convo.id?.endsWith(query));
});

COMMANDS.set('e164EndsWith', (conversations, query) => {
  return conversations.filter(convo => convo.e164?.endsWith(query));
});

COMMANDS.set('groupIdEndsWith', (conversations, query) => {
  return conversations.filter(convo => convo.groupId?.endsWith(query));
});

// See https://fusejs.io/examples.html#extended-search for
// extended search documentation.
function searchConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string,
  regionCode: string | undefined
): ReadonlyArray<Pick<Fuse.FuseResult<ConversationType>, 'item' | 'score'>> {
  const maybeCommand = searchTerm.match(/^!([^\s]+):(.*)$/);
  if (maybeCommand) {
    const [, commandName, query] = maybeCommand;

    const command = COMMANDS.get(commandName);
    if (command) {
      return command(conversations, query).map(item => ({ item }));
    }
  }

  const phoneNumber = parseAndFormatPhoneNumber(searchTerm, regionCode);

  // Escape the search term
  let extendedSearchTerm = searchTerm;

  // OR phoneNumber
  if (phoneNumber) {
    extendedSearchTerm += ` | ${phoneNumber.e164}`;
  }

  let index = cachedIndices.get(conversations);
  if (!index) {
    index = new Fuse<ConversationType>(conversations, FUSE_OPTIONS);
    cachedIndices.set(conversations, index);
  }

  return index.search(extendedSearchTerm);
}

export function filterAndSortConversationsByRecent(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string,
  regionCode: string | undefined
): Array<ConversationType> {
  if (searchTerm.length) {
    const now = Date.now();

    return searchConversations(conversations, searchTerm, regionCode)
      .slice()
      .sort((a, b) => {
        const { activeAt: aActiveAt = 0, left: aLeft = false } = a.item;
        const { activeAt: bActiveAt = 0, left: bLeft = false } = b.item;

        // See: https://fusejs.io/api/options.html#includescore
        // 0 score is a perfect match, 1 - complete mismatch
        const aScore =
          (now - aActiveAt) * ACTIVE_AT_SCORE_FACTOR +
          (a.score ?? 0) +
          (aLeft ? LEFT_GROUP_PENALTY : 0);
        const bScore =
          (now - bActiveAt) * ACTIVE_AT_SCORE_FACTOR +
          (b.score ?? 0) +
          (bLeft ? LEFT_GROUP_PENALTY : 0);

        return aScore - bScore;
      })
      .map(result => result.item);
  }

  return conversations.concat().sort((a, b) => {
    if (a.activeAt && b.activeAt) {
      return a.activeAt > b.activeAt ? -1 : 1;
    }

    return a.activeAt && !b.activeAt ? -1 : 1;
  });
}
