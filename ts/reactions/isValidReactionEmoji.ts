// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import emojiRegex from 'emoji-regex';
import { getGraphemes } from '../util/grapheme.std.js';
import { take, size } from '../util/iterables.std.js';

export function isValidReactionEmoji(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  // This is effectively `countGraphemes(value) === 1`, but doesn't require iterating
  //   through an extremely long string.
  const graphemes = getGraphemes(value);
  const truncatedGraphemes = take(graphemes, 2);
  if (size(truncatedGraphemes) !== 1) {
    return false;
  }

  return emojiRegex().test(value);
}
