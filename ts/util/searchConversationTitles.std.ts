// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Fuse from 'fuse.js';

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { fuseGetFnRemoveDiacritics, getCachedFuseIndex } from './fuse.std.js';

const CONVERSATION_TITLE = 'title';
const MIN_SEARCH_TERM_LENGTH = 2;
const segmenter = new Intl.Segmenter([], { granularity: 'word' });
const FUSE_OPTIONS: Fuse.IFuseOptions<ConversationType> = {
  keys: [CONVERSATION_TITLE],
  getFn: (...args) => {
    const text = fuseGetFnRemoveDiacritics(...args);
    return [
      ...segmenter.segment(typeof text === 'string' ? text : text.join(' ')),
    ].map(word => word.segment);
  },
  isCaseSensitive: false,
  includeScore: false,
  shouldSort: true,
  // Setting location, distance, and threshold to zero returns only exact prefix matches
  // i.e. matches that start at index 0 and where every character matches the query
  location: 0,
  distance: 0,
  threshold: 0,
};

export function searchConversationTitles(
  conversations: ReadonlyArray<ConversationType>,
  searchTerms: Array<string>
): Array<ConversationType> {
  // Searches all conversation titles where
  const index = getCachedFuseIndex(conversations, FUSE_OPTIONS);
  const searchQuery: Fuse.Expression = {
    $or: searchTerms
      .filter(term => term.length >= MIN_SEARCH_TERM_LENGTH)
      .map(term => ({ [CONVERSATION_TITLE]: term })),
  };
  return index.search(searchQuery).map(result => result.item);
}
