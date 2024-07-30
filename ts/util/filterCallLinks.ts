// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Fuse from 'fuse.js';
import { fuseGetFnRemoveDiacritics, getCachedFuseIndex } from './fuse';
import { removeDiacritics } from './removeDiacritics';
import type { CallLinkType } from '../types/CallLink';

// Based on parameters in filterAndSortConversations
const FUSE_OPTIONS: Fuse.IFuseOptions<CallLinkType> = {
  threshold: 0.2,
  includeScore: true,
  useExtendedSearch: true,
  shouldSort: true,
  distance: 200,
  keys: [
    {
      name: 'name',
      weight: 1,
    },
  ],
  getFn: (item, path) => {
    if (
      (path === 'name' || (path.length === 1 && path[0] === 'name')) &&
      item.name === ''
    ) {
      return removeDiacritics(
        window.i18n('icu:calling__call-link-default-title')
      );
    }

    return fuseGetFnRemoveDiacritics(item, path);
  },
};

function searchCallLinks(
  callLinks: ReadonlyArray<CallLinkType>,
  searchTerm: string
): ReadonlyArray<Pick<Fuse.FuseResult<CallLinkType>, 'item' | 'score'>> {
  // TODO: DESKTOP-6974

  // Escape the search term
  const extendedSearchTerm = removeDiacritics(searchTerm);

  const index = getCachedFuseIndex(callLinks, FUSE_OPTIONS);

  return index.search(extendedSearchTerm);
}

function startsWithLetter(title: string) {
  return /^\p{Letter}/u.test(title);
}

function sortAlphabetically(a: CallLinkType, b: CallLinkType) {
  const aStartsWithLetter = startsWithLetter(a.name);
  const bStartsWithLetter = startsWithLetter(b.name);
  if (aStartsWithLetter && !bStartsWithLetter) {
    return -1;
  }
  if (!aStartsWithLetter && bStartsWithLetter) {
    return 1;
  }
  return a.name.localeCompare(b.name);
}

export function filterCallLinks(
  callLinks: ReadonlyArray<CallLinkType>,
  searchTerm: string
): Array<CallLinkType> {
  if (searchTerm.length) {
    return searchCallLinks(callLinks, searchTerm)
      .slice()
      .sort((a, b) => {
        const score = (a.score ?? 0) - (b.score ?? 0);
        if (score !== 0) {
          return score;
        }
        return sortAlphabetically(a.item, b.item);
      })
      .map(result => result.item);
  }

  return callLinks.concat().sort((a, b) => {
    return sortAlphabetically(a, b);
  });
}
