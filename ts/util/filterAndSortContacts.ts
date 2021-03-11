// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse, { FuseOptions } from 'fuse.js';

import { ConversationType } from '../state/ducks/conversations';

const FUSE_OPTIONS: FuseOptions<ConversationType> = {
  // A small-but-nonzero threshold lets us match parts of E164s better, and makes the
  //   search a little more forgiving.
  threshold: 0.05,
  keys: ['title', 'name', 'e164'],
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
  return contacts.concat().sort((a, b) => collator.compare(a.title, b.title));
}
