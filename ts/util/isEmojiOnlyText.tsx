// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import emojiRegex from 'emoji-regex';

export function isEmojiOnlyText(text: string): boolean {
  if (text.length === 0) {
    return false;
  }

  const regex = emojiRegex();
  let len = 0;
  for (const match of text.matchAll(regex)) {
    // Skipped some non-emoji text, return early
    if (match.index !== len) {
      return false;
    }

    len += match[0].length;
  }
  return len === text.length;
}
