// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import emojiRegex from 'emoji-regex';

import { assertDev } from './assert.std.js';
import { take } from './iterables.std.js';

const REGEXP = emojiRegex();
const MAX_EMOJI_TO_MATCH = 5000;

export function replaceEmojiWithSpaces(value: string): string {
  return value.replace(REGEXP, ' ');
}

export type SplitElement = Readonly<{
  type: 'emoji' | 'text';
  value: string;
}>;

export function splitByEmoji(value: string): ReadonlyArray<SplitElement> {
  const emojis = take(value.matchAll(REGEXP), MAX_EMOJI_TO_MATCH);

  const result: Array<SplitElement> = [];
  let lastIndex = 0;
  for (const match of emojis) {
    const nonEmojiText = value.slice(lastIndex, match.index);
    if (nonEmojiText) {
      result.push({ type: 'text', value: nonEmojiText });
    }

    result.push({ type: 'emoji', value: match[0] });

    assertDev(match.index !== undefined, '`matchAll` should provide indices');
    lastIndex = match.index + match[0].length;
  }

  const finalNonEmojiText = value.slice(lastIndex);
  if (finalNonEmojiText) {
    result.push({ type: 'text', value: finalNonEmojiText });
  }

  return result;
}
