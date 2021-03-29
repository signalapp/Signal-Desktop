// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse, { FuseOptions } from 'fuse.js';

import { ConversationType } from '../state/ducks/conversations';

const FUSE_OPTIONS: FuseOptions<ConversationType> = {
  // A small-but-nonzero threshold lets us match parts of E164s better, and makes the
  //   search a little more forgiving.
  threshold: 0.05,
  tokenize: true,
  keys: [
    {
      name: 'title',
      weight: 1,
    },
    {
      name: 'name',
      weight: 1,
    },
    {
      name: 'e164',
      weight: 0.5,
    },
  ],
};

const collator = new Intl.Collator();

export function filterAndSortContacts(
  contacts: ReadonlyArray<ConversationType>,
  searchTerm: string
): Array<ConversationType> {
  if (searchTerm.length) {
    return new Fuse<ConversationType>(contacts, FUSE_OPTIONS).search(
      searchTerm
    );
  }

  return contacts.concat().sort((a, b) => {
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
