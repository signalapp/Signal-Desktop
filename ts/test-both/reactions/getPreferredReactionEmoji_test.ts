// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../../reactions/constants';

import { getPreferredReactionEmoji } from '../../reactions/getPreferredReactionEmoji';

describe('getPreferredReactionEmoji', () => {
  it('returns the default set if passed anything invalid', () => {
    [
      // Invalid types
      undefined,
      null,
      DEFAULT_PREFERRED_REACTION_EMOJI.join(','),
      // Invalid lengths
      [],
      DEFAULT_PREFERRED_REACTION_EMOJI.slice(0, 3),
      [...DEFAULT_PREFERRED_REACTION_EMOJI, 'sparkles'],
      // Non-strings in the array
      ['heart', 'thumbsdown', undefined, 'joy', 'open_mouth', 'cry'],
      ['heart', 'thumbsdown', 99, 'joy', 'open_mouth', 'cry'],
      // Invalid emoji
      ['heart', 'thumbsdown', 'gorbage!!', 'joy', 'open_mouth', 'cry'],
      // Has duplicates
      ['heart', 'thumbsdown', 'joy', 'joy', 'open_mouth', 'cry'],
    ].forEach(input => {
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input),
        DEFAULT_PREFERRED_REACTION_EMOJI
      );
    });
  });

  it('returns a custom set if passed a valid value', () => {
    const input = [
      'sparkles',
      'sparkle',
      'sparkler',
      'shark',
      'sparkling_heart',
      'parking',
    ];
    assert.deepStrictEqual(getPreferredReactionEmoji(input), input);
  });
});
