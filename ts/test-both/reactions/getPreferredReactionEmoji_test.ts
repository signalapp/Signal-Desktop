// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES } from '../../reactions/constants';

import { getPreferredReactionEmoji } from '../../reactions/getPreferredReactionEmoji';

describe('getPreferredReactionEmoji', () => {
  it('returns the default set if passed anything invalid', () => {
    [
      // Invalid types
      undefined,
      null,
      DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES.join(','),
      // Invalid lengths
      [],
      DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES.slice(0, 3),
      [...DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES, '✨'],
      // Non-strings in the array
      ['❤️', '👍', undefined, '😂', '😮', '😢'],
      ['❤️', '👍', 99, '😂', '😮', '😢'],
      // Invalid emoji
      ['❤️', '👍', 'x', '😂', '😮', '😢'],
      ['❤️', '👍', 'garbage!!', '😂', '😮', '😢'],
      ['❤️', '👍', '✨✨', '😂', '😮', '😢'],
    ].forEach(input => {
      assert.deepStrictEqual(getPreferredReactionEmoji(input, 2), [
        '❤️',
        '👍🏼',
        '👎🏼',
        '😂',
        '😮',
        '😢',
      ]);
    });
  });

  it('returns a custom set if passed a valid value', () => {
    const input = ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'];
    assert.deepStrictEqual(getPreferredReactionEmoji(input, 3), input);
  });
});
