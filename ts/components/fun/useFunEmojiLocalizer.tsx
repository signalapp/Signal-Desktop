// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback } from 'react';
import type { EmojiParentKey, EmojiVariantKey } from './data/emojis';
import {
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
    index.set(parentKey, entry.tags.at(0) ?? entry.shortName);
  }

  return index;
}

export function useFunEmojiLocalizer(): FunEmojiLocalizer {
  const { emojiLocalizerIndex } = useFunEmojiLocalization();
  const emojiLocalizer: FunEmojiLocalizer = useCallback(
    variantKey => {
      const parentKey = getEmojiParentKeyByVariantKey(variantKey);
      const localeShortName = emojiLocalizerIndex.get(parentKey);
      strictAssert(
        localeShortName,
        `useFunEmojiLocalizer: Missing translation for ${variantKey}`
      );
      return localeShortName;
    },
    [emojiLocalizerIndex]
  );
  return emojiLocalizer;
}
