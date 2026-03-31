// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { createLogger } from '../logging/log.std.js';
import { DEFAULT_PREFERRED_REACTION_EMOJI_PARENT_KEYS } from './constants.std.js';
import { isValidReactionEmoji } from './isValidReactionEmoji.std.js';
import {
  getEmojiVariantByParentKeyAndSkinTone,
  getEmojiVariantKeyByValue,
  getEmojiParentKeyByVariantKey,
  isEmojiVariantValue,
  type EmojiSkinTone,
} from '../components/fun/data/emojis.std.js';

const { times } = lodash;

const log = createLogger('preferredReactionEmoji');

const MAX_STORED_LENGTH = 20;
const MAX_ITEM_LENGTH = 20;

const PREFERRED_REACTION_EMOJI_COUNT =
  DEFAULT_PREFERRED_REACTION_EMOJI_PARENT_KEYS.length;

export function getPreferredReactionEmoji(
  storedValue: unknown,
  emojiSkinToneDefault: EmojiSkinTone
): Array<string> {
  const storedValueAsArray: Array<unknown> = Array.isArray(storedValue)
    ? storedValue
    : [];

  return times(PREFERRED_REACTION_EMOJI_COUNT, index => {
    const storedItem: unknown = storedValueAsArray[index];
    if (isValidReactionEmoji(storedItem)) {
      return applyEmojiSkinTone(storedItem, emojiSkinToneDefault);
    }

    const fallbackParentKey =
      DEFAULT_PREFERRED_REACTION_EMOJI_PARENT_KEYS.at(index);
    if (fallbackParentKey == null) {
      log.error(
        'Index is out of range. Is the preferred count larger than the list of fallbacks?'
      );
      return '❤️';
    }

    const fallbackEmoji = getEmojiVariantByParentKeyAndSkinTone(
      fallbackParentKey,
      emojiSkinToneDefault
    );
    if (fallbackEmoji == null) {
      log.error(
        'No fallback emoji. Does the fallback list contain an invalid short name?'
      );
      return '❤️';
    }

    return fallbackEmoji.value;
  });
}

function applyEmojiSkinTone(
  emoji: string,
  skinTone: EmojiSkinTone
): string {
  if (!isEmojiVariantValue(emoji)) {
    return emoji;
  }
  const variantKey = getEmojiVariantKeyByValue(emoji);
  const parentKey = getEmojiParentKeyByVariantKey(variantKey);
  const newVariant = getEmojiVariantByParentKeyAndSkinTone(
    parentKey,
    skinTone
  );
  return newVariant.value;
}

export const canBeSynced = (value: unknown): value is Array<string> =>
  Array.isArray(value) &&
  value.length <= MAX_STORED_LENGTH &&
  value.every(
    item => typeof item === 'string' && item.length <= MAX_ITEM_LENGTH
  );
