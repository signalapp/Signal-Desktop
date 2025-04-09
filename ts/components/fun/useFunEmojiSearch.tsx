// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Fuse from 'fuse.js';
import { sortBy } from 'lodash';
import { useMemo } from 'react';
import type { EmojiParentKey } from './data/emojis';
import {
  getEmojiParentByKey,
  getEmojiParentKeyByValue,
  isEmojiParentValue,
} from './data/emojis';
import type { LocaleEmojiListType } from '../../types/emoji';
import { useFunEmojiLocalization } from './FunEmojiLocalizationProvider';

export type FunEmojiSearchIndexEntry = Readonly<{
  key: EmojiParentKey;
  rank: number | null;
  shortName: string;
  shortNames: ReadonlyArray<string>;
  emoticon: string | null;
  emoticons: ReadonlyArray<string>;
}>;

export type FunEmojiSearchIndex = ReadonlyArray<FunEmojiSearchIndexEntry>;

export type FunEmojiSearch = (
  query: string,
  limit?: number
) => ReadonlyArray<EmojiParentKey>;

export function createFunEmojiSearchIndex(
  localeEmojiList: LocaleEmojiListType
): FunEmojiSearchIndex {
  const results: Array<FunEmojiSearchIndexEntry> = [];

  for (const localeEmoji of localeEmojiList) {
    if (!isEmojiParentValue(localeEmoji.emoji)) {
      // Skipping unknown emoji, most likely apple doesn't support it
      continue;
    }

    const parentKey = getEmojiParentKeyByValue(localeEmoji.emoji);
    const emoji = getEmojiParentByKey(parentKey);
    results.push({
      key: parentKey,
      rank: localeEmoji.rank,
      shortName: localeEmoji.shortName,
      shortNames: localeEmoji.tags,
      emoticon: emoji.emoticonDefault,
      emoticons: emoji.emoticons,
    });
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
};

const FuseExactOptions: Fuse.IFuseOptions<FunEmojiSearchIndexEntry> = {
  shouldSort: false,
  threshold: 0,
  minMatchCharLength: 1,
  keys: FuseKeys,
  includeScore: true,
};

function createFunEmojiSearch(
  emojiSearchIndex: FunEmojiSearchIndex
): FunEmojiSearch {
  const fuseIndex = Fuse.createIndex(FuseKeys, emojiSearchIndex);
  const fuseFuzzy = new Fuse(emojiSearchIndex, FuseFuzzyOptions, fuseIndex);
  const fuseExact = new Fuse(emojiSearchIndex, FuseExactOptions, fuseIndex);

  return function emojiSearch(query, limit = 200) {
    // Prefer exact matches at 2 characters
    const fuse = query.length < 2 ? fuseExact : fuseFuzzy;

    const rawResults = fuse.search(query.substring(0, 32), {
      limit: limit * 2,
    });

    const rankedResults = rawResults.map(result => {
      const rank = result.item.rank ?? 1e9;

      // Exact prefix matches in [0,1] range
      if (result.item.shortName.startsWith(query)) {
        return {
          score: result.item.shortName.length / query.length,
          item: result.item,
        };
      }

      // Other matches in [1,], ordered by score and rank
      return {
        score: 1 + (result.score ?? 0) + rank / emojiSearchIndex.length,
        item: result.item,
      };
    });

    const sortedResults = sortBy(rankedResults, result => {
      return result.score;
    });

    const truncatedResults = sortedResults.slice(0, limit);

    return truncatedResults.map(result => {
      return result.item.key;
    });
  };
}

export function useFunEmojiSearch(): FunEmojiSearch {
  const { emojiSearchIndex } = useFunEmojiLocalization();
  const emojiSearch = useMemo(() => {
    return createFunEmojiSearch(emojiSearchIndex);
  }, [emojiSearchIndex]);
  return emojiSearch;
}
