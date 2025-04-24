// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useMemo } from 'react';
import type { EmojiParentKey, EmojiVariantKey } from './data/emojis';
import {
  getEmojiParentByKey,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from './data/emojis';
import type { LocaleEmojiListType } from '../../types/emoji';
import { strictAssert } from '../../util/assert';
import { useFunEmojiLocalization } from './FunEmojiLocalizationProvider';

export type FunEmojiLocalizerIndex = ReadonlyMap<EmojiParentKey, string>;
export type FunEmojiLocalizer = (key: EmojiVariantKey) => string;

export function createFunEmojiLocalizerIndex(
  localeEmojiList: LocaleEmojiListType
): FunEmojiLocalizerIndex {
  const index = new Map<EmojiParentKey, string>();

  for (const entry of localeEmojiList) {
    strictAssert(
      isEmojiVariantValue(entry.emoji),
      'createFunEmojiLocalizerIndex: Must be emoji variant value'
    );

    const variantKey = getEmojiVariantKeyByValue(entry.emoji);
    const parentKey = getEmojiParentKeyByVariantKey(variantKey);
    const localizedShortName = entry.tags.at(0) ?? entry.shortName;
    index.set(parentKey, localizedShortName);
  }

  return index;
}

/** @internal exported for tests */
export function _createFunEmojiLocalizer(
  emojiLocalizerIndex: FunEmojiLocalizerIndex
): FunEmojiLocalizer {
  return variantKey => {
    const parentKey = getEmojiParentKeyByVariantKey(variantKey);
    const localeShortName = emojiLocalizerIndex.get(parentKey);
    if (localeShortName != null) {
      return localeShortName;
    }
    // Fallback to english short name
    const parent = getEmojiParentByKey(parentKey);
    return parent.englishShortNameDefault;
  };
}

export function useFunEmojiLocalizer(): FunEmojiLocalizer {
  const { emojiLocalizerIndex } = useFunEmojiLocalization();
  const emojiLocalizer = useMemo(() => {
    return _createFunEmojiLocalizer(emojiLocalizerIndex);
  }, [emojiLocalizerIndex]);
  return emojiLocalizer;
}
