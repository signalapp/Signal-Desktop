// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Emoji } from '../axo/emoji.std.ts';

const MAX_STORED_LENGTH = 20;
const MAX_ITEM_LENGTH = 20;

export function getPreferredReactionEmoji(
  storedValueTyped: ReadonlyArray<string> | undefined,
  emojiSkinToneDefault: Emoji.SkinTone
): Array<Emoji.Variant> {
  const storedValue = storedValueTyped as Array<string | null | undefined>;

  const defaultEmojis =
    Emoji.getDefaultPreferredReactionEmojis(emojiSkinToneDefault);

  return defaultEmojis.map((defaultEmoji, index) => {
    const storedItem = storedValue?.[index];
    if (storedItem != null && Emoji.isEmoji(storedItem)) {
      return Emoji.ignorePreferredSkinTone(storedItem);
    }

    return defaultEmoji;
  });
}

export function canBeSynced<T extends string>(
  typedValue: ReadonlyArray<T> | undefined
): typedValue is Array<T> {
  const value: unknown = typedValue;
  return (
    Array.isArray(value) &&
    value.length <= MAX_STORED_LENGTH &&
    value.every(item => {
      return typeof item === 'string' && item.length <= MAX_ITEM_LENGTH;
    })
  );
}
