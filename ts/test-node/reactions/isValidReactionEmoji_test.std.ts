// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isValidReactionEmoji } from '../../reactions/isValidReactionEmoji.std.ts';

describe('isValidReactionEmoji', () => {
  it('returns false for non-strings', () => {
    assert.isFalse(isValidReactionEmoji(undefined));
    assert.isFalse(isValidReactionEmoji(null));
    assert.isFalse(isValidReactionEmoji(1));
  });

  it("returns false for strings that aren't a single emoji", () => {
    assert.isFalse(isValidReactionEmoji(''));

    assert.isFalse(isValidReactionEmoji('a'));
    assert.isFalse(isValidReactionEmoji('abc'));

    assert.isFalse(isValidReactionEmoji('💩💩'));

    assert.isFalse(isValidReactionEmoji('🇸'));
    assert.isFalse(isValidReactionEmoji('‍'));
  });

  it('returns true for strings that are exactly 1 emoji', () => {
    assert.isTrue(isValidReactionEmoji('🇺🇸'));
    assert.isTrue(isValidReactionEmoji('👍'));
    assert.isTrue(isValidReactionEmoji('👍🏾'));
    assert.isTrue(isValidReactionEmoji('👩‍❤️‍👩'));
  });
});
