// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FuseOptions } from 'fuse.js';
import Fuse from 'fuse.js';

import type { ConversationType } from '../state/ducks/conversations';

const FUSE_OPTIONS: FuseOptions<ConversationType> = {
  // A small-but-nonzero threshold lets us match parts of E164s better, and makes the
  //   search a little more forgiving.
  threshold: 0.05,
  tokenize: true,
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

function searchConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string
): Array<ConversationType> {
  return new Fuse<ConversationType>(conversations, FUSE_OPTIONS).search(
    searchTerm
  );
}

export function filterAndSortConversationsByRecent(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string
): Array<ConversationType> {
  if (searchTerm.length) {
    return searchConversations(conversations, searchTerm);
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
  searchTerm: string
): Array<ConversationType> {
  if (searchTerm.length) {
    return searchConversations(conversations, searchTerm);
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
