// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Fuse from 'fuse.js';
import type { ConversationType } from '../state/ducks/conversations';
import { parseAndFormatPhoneNumber } from './libphonenumberInstance';
import { WEEK } from './durations';
import { fuseGetFnRemoveDiacritics, getCachedFuseIndex } from './fuse';
import { countConversationUnreadStats, hasUnread } from './countUnreadStats';
import { getE164 } from './getE164';
import { removeDiacritics } from './removeDiacritics';
import { isAciString } from './isAciString';

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
  // 200 is about right (contact names can get longer than the max for group titles)
  distance: 200,
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
  getFn: (convo, path) => {
    if (path === 'e164' || (path.length === 1 && path[0] === 'e164')) {
      return getE164(convo) ?? '';
    }

    return fuseGetFnRemoveDiacritics(convo, path);
  },
};

type CommandRunnerType = (
  conversations: ReadonlyArray<ConversationType>,
  query: string
) => Array<ConversationType>;

const COMMANDS = new Map<string, CommandRunnerType>();

function filterConversationsByUnread(
  conversations: ReadonlyArray<ConversationType>,
  includeMuted: boolean
): Array<ConversationType> {
  return conversations.filter(conversation => {
    return hasUnread(
      countConversationUnreadStats(conversation, { includeMuted })
    );
  });
}

COMMANDS.set('serviceIdEndsWith', (conversations, query) => {
  return conversations.filter(convo => convo.serviceId?.endsWith(query));
});

COMMANDS.set('aciEndsWith', (conversations, query) => {
  return conversations.filter(
    convo => isAciString(convo.serviceId) && convo.serviceId.endsWith(query)
  );
});

COMMANDS.set('pniEndsWith', (conversations, query) => {
  return conversations.filter(convo => convo.pni?.endsWith(query));
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

COMMANDS.set('unread', (conversations, query) => {
  const includeMuted =
    /^(?:m|muted)$/i.test(query) ||
    window.storage.get('badge-count-muted-conversations') ||
    false;
  return filterConversationsByUnread(conversations, includeMuted);
});

// See https://fusejs.io/examples.html#extended-search for
// extended search documentation.
function searchConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string,
  regionCode: string | undefined
): ReadonlyArray<Pick<Fuse.FuseResult<ConversationType>, 'item' | 'score'>> {
  const maybeCommand = searchTerm.match(/^!([^\s:]+)(?::(.*))?$/);
  if (maybeCommand) {
    const [, commandName, query] = maybeCommand;

    const command = COMMANDS.get(commandName);
    if (command) {
      return command(conversations, query).map(item => ({ item }));
    }
  }

  const phoneNumber = parseAndFormatPhoneNumber(searchTerm, regionCode);

  // Escape the search term
  let extendedSearchTerm = removeDiacritics(searchTerm);

  // OR phoneNumber
  if (phoneNumber) {
    extendedSearchTerm += ` | ${phoneNumber.e164}`;
  }

  const index = getCachedFuseIndex(conversations, FUSE_OPTIONS);

  return index.search(extendedSearchTerm);
}

function startsWithLetter(title: string) {
  // Uses \p, the unicode character class escape, to check if a the first character is a
  // letter
  return /^\p{Letter}/u.test(title);
}

function sortAlphabetically(a: ConversationType, b: ConversationType) {
  // Sort alphabetically with conversations starting with a letter first (and phone
  // numbers last)
  const aStartsWithLetter = startsWithLetter(a.title);
  const bStartsWithLetter = startsWithLetter(b.title);
  if (aStartsWithLetter && !bStartsWithLetter) {
    return -1;
  }
  if (!aStartsWithLetter && bStartsWithLetter) {
    return 1;
  }
  return a.title.localeCompare(b.title);
}

export function filterAndSortConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string,
  regionCode: string | undefined,
  filterByUnread: boolean = false,
  conversationToInject?: ConversationType
): Array<ConversationType> {
  let filteredConversations = filterByUnread
    ? filterConversationsByUnread(conversations, true)
    : conversations;

  if (conversationToInject) {
    filteredConversations = [...filteredConversations, conversationToInject];
  }

  if (searchTerm.length) {
    const now = Date.now();
    const withoutUnknownAndFiltered = filteredConversations.filter(
      item => item.titleNoDefault
    );

    return searchConversations(
      withoutUnknownAndFiltered,
      searchTerm,
      regionCode
    )
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

        const activeScore = aScore - bScore;
        if (activeScore !== 0) {
          return activeScore;
        }
        return sortAlphabetically(a.item, b.item);
      })
      .map(result => result.item);
  }

  return filteredConversations.concat().sort((a, b) => {
    const aScore = a.activeAt ?? 0;
    const bScore = b.activeAt ?? 0;
    const score = bScore - aScore;
    if (score !== 0) {
      return score;
    }
    return sortAlphabetically(a, b);
  });
}
