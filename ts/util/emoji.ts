// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-restricted-syntax */

import emojiRegex from 'emoji-regex/es2015/RGI_Emoji';

import { assert } from './assert';

const REGEXP = emojiRegex();

export function replaceEmojiWithSpaces(value: string): string {
  return value.replace(REGEXP, ' ');
}

export type SplitElement = Readonly<{
  type: 'emoji' | 'text';
  value: string;
}>;

export function splitByEmoji(value: string): ReadonlyArray<SplitElement> {
  const emojis = value.matchAll(REGEXP);

  const result: Array<SplitElement> = [];
  let lastIndex = 0;
  for (const match of emojis) {
    result.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    result.push({ type: 'emoji', value: match[0] });

    assert(match.index !== undefined, '`matchAll` should provide indices');
    lastIndex = match.index + match[0].length;
  }

  result.push({ type: 'text', value: value.slice(lastIndex) });

  return result;
}
