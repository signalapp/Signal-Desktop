// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Fuse from 'fuse.js';
import lodash from 'lodash';
import { useMemo } from 'react';
import type { EmojiParentKey } from './data/emojis.std.js';
import {
  getEmojiParentByKey,
  getEmojiParentKeyByValue,
  isEmojiParentValue,
  isEmojiParentValueDeprecated,
  normalizeShortNameCompletionQuery,
} from './data/emojis.std.js';
import type { LocaleEmojiListType } from '../../types/emoji.std.js';
import { useFunEmojiLocalization } from './FunEmojiLocalizationProvider.dom.js';

const { sortBy } = lodash;

export type FunEmojiSearchIndexEntry = Readonly<{
  key: EmojiParentKey;
  rank: number | null;
  shortName: string;
  shortNames: ReadonlyArray<string>;
  emoticon: string | null;
  emoticons: ReadonlyArray<string>;
}>;

export type FunEmojiSearchIndex = ReadonlyArray<FunEmojiSearchIndexEntry>;

export type FunEmojiSearchResult = Readonly<{
  parentKey: EmojiParentKey;
}>;

export type FunEmojiSearch = (
  query: string,
  limit?: number
) => ReadonlyArray<FunEmojiSearchResult>;

export function createFunEmojiSearchIndex(
  localeEmojiList: LocaleEmojiListType,
  defaultSearchIndex: ReadonlyArray<FunEmojiSearchIndexEntry> = []
): FunEmojiSearchIndex {
  const results: Array<FunEmojiSearchIndexEntry> = [];

  const localizedKeys = new Set<string>();

  for (const localeEmoji of localeEmojiList) {
    if (!isEmojiParentValue(localeEmoji.emoji)) {
      // Skipping unknown emoji, most likely apple doesn't support it
      continue;
    }

    if (isEmojiParentValueDeprecated(localeEmoji.emoji)) {
      // Skipping deprecated emoji
      continue;
    }

    const parentKey = getEmojiParentKeyByValue(localeEmoji.emoji);
    const emoji = getEmojiParentByKey(parentKey);
    localizedKeys.add(parentKey);
    results.push({
      key: parentKey,
      rank: localeEmoji.rank,
      shortName: normalizeShortNameCompletionQuery(localeEmoji.shortName),
      shortNames: localeEmoji.tags.map(tag => {
        return normalizeShortNameCompletionQuery(tag);
      }),
      emoticon: emoji.emoticonDefault,
      emoticons: emoji.emoticons,
    });
  }

  for (const defaultEntry of defaultSearchIndex) {
    if (!localizedKeys.has(defaultEntry.key)) {
      results.push(defaultEntry);
    }
  }

  return results;
}

const FuseKeys: Array<Fuse.FuseOptionKey> = [
  { name: 'shortName', weight: 100 },
  { name: 'shortNames', weight: 1 },
  { name: 'emoticon', weight: 50 },
  { name: 'emoticons', weight: 1 },
];

const FuseFuzzyOptions: Fuse.IFuseOptions<FunEmojiSearchIndexEntry> = {
  shouldSort: false,
  threshold: 0.2,
  minMatchCharLength: 1,
  keys: FuseKeys,
  includeScore: true,
  includeMatches: true,
};

const FuseExactOptions: Fuse.IFuseOptions<FunEmojiSearchIndexEntry> = {
  shouldSort: false,
  threshold: 0,
  minMatchCharLength: 1,
  keys: FuseKeys,
  includeScore: true,
  includeMatches: true,
};

/** @internal exported for tests */
export function _createFunEmojiSearch(
  emojiSearchIndex: FunEmojiSearchIndex
): FunEmojiSearch {
  const fuseIndex = Fuse.createIndex(FuseKeys, emojiSearchIndex);
  const fuseFuzzy = new Fuse(emojiSearchIndex, FuseFuzzyOptions, fuseIndex);
  const fuseExact = new Fuse(emojiSearchIndex, FuseExactOptions, fuseIndex);

  return function emojiSearch(rawQuery, limit = 200) {
    const query = normalizeShortNameCompletionQuery(rawQuery);

    // Prefer exact matches at 2 characters
    const fuse = query.length < 2 ? fuseExact : fuseFuzzy;

    const rawResults = fuse.search(query.substring(0, 32));

    // Note: lodash's sortBy() only calls each iteratee once
    const sortedResults = sortBy(rawResults, result => {
      const rank = result.item.rank ?? 1e9;

      const localizedQueryMatch =
        result.item.shortNames.at(0) ?? result.item.shortName;

      // Exact prefix matches in [0,1] range
      if (localizedQueryMatch.startsWith(query)) {
        // Note: localizedQueryMatch will always be <= in length to the query
        const matchRatio = query.length / localizedQueryMatch.length; // 1-0
        return 1 - matchRatio;
      }

      const queryScore = result.score ?? 0; // 0-1
      const rankScore = rank / emojiSearchIndex.length; // 0-1

      // Other matches in [1,], ordered by score and rank
      return 1 + queryScore + rankScore;
    });

    return sortedResults.slice(0, limit).map(result => {
      return { parentKey: result.item.key };
    });
  };
}

export function useFunEmojiSearch(): FunEmojiSearch {
  const { emojiSearchIndex } = useFunEmojiLocalization();
  const emojiSearch = useMemo(() => {
    return _createFunEmojiSearch(emojiSearchIndex);
  }, [emojiSearchIndex]);
  return emojiSearch;
}
