// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';

import type { ConversationType } from '../state/ducks/conversations';
import { parseAndFormatPhoneNumber } from './libphonenumberInstance';

const FUSE_OPTIONS: Fuse.IFuseOptions<ConversationType> = {
  // A small-but-nonzero threshold lets us match parts of E164s better, and makes the
  //   search a little more forgiving.
  threshold: 0.1,
  useExtendedSearch: true,
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

const collator = new Intl.Collator();

const cachedIndices = new WeakMap<
  ReadonlyArray<ConversationType>,
  Fuse<ConversationType>
>();

// See https://fusejs.io/examples.html#extended-search for
// extended search documentation.
function searchConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string,
  regionCode: string | undefined
): Array<ConversationType> {
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

  const results = index.search(extendedSearchTerm);
  return results.map(result => result.item);
}

export function filterAndSortConversationsByRecent(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string,
  regionCode: string | undefined
): Array<ConversationType> {
  if (searchTerm.length) {
    return searchConversations(conversations, searchTerm, regionCode);
  }

  return conversations.concat().sort((a, b) => {
    if (a.activeAt && b.activeAt) {
      return a.activeAt > b.activeAt ? -1 : 1;
    }

    return a.activeAt && !b.activeAt ? -1 : 1;
  });
}

export function filterAndSortConversationsByTitle(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string,
  regionCode: string | undefined
): Array<ConversationType> {
  if (searchTerm.length) {
    return searchConversations(conversations, searchTerm, regionCode);
  }

  return conversations.concat().sort((a, b) => {
    const aHasName = hasName(a);
    const bHasName = hasName(b);

    if (aHasName === bHasName) {
      return collator.compare(a.title, b.title);
    }

    return aHasName && !bHasName ? -1 : 1;
  });
}

function hasName(contact: Readonly<ConversationType>): boolean {
  return Boolean(contact.name || contact.profileName);
}
