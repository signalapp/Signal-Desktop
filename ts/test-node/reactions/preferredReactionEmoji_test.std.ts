// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  canBeSynced,
  getPreferredReactionEmoji,
} from '../../reactions/preferredReactionEmoji.std.js';
import { EmojiSkinTone } from '../../components/fun/data/emojis.std.js';

describe('preferred reaction emoji utilities', () => {
  describe('getPreferredReactionEmoji', () => {
    const defaultsForSkinTone2 = ['❤️', '👍🏼', '👎🏼', '😂', '😮', '😢'];

    it('returns the default set if passed a non-array', () => {
      [undefined, null, '❤️👍🏼👎🏼😂😮😢'].forEach(input => {
        assert.deepStrictEqual(
          getPreferredReactionEmoji(input, EmojiSkinTone.Type2),
          defaultsForSkinTone2
        );
      });
    });

    it('returns the default set if passed an empty array', () => {
      assert.deepStrictEqual(
        getPreferredReactionEmoji([], EmojiSkinTone.Type2),
        defaultsForSkinTone2
      );
    });

    it('falls back to defaults if passed an array that is too short', () => {
      const input = ['✨', '❇️'];
      const expected = ['✨', '❇️', '👎🏽', '😂', '😮', '😢'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, EmojiSkinTone.Type3),
        expected
      );
    });

    it('falls back to defaults when passed an array with some invalid values', () => {
      const input = ['✨', 'invalid', '🎇', '🦈', undefined, ''];
      const expected = ['✨', '👍🏼', '🎇', '🦈', '😮', '😢'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, EmojiSkinTone.Type2),
        expected
      );
    });

    it('returns a custom set if passed a valid value', () => {
      const input = ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, EmojiSkinTone.Type3),
        input
      );
    });

    it('only returns the first few emoji if passed a value that is too long', () => {
      const expected = ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'];
      const input = [...expected, '💅', '💅', '💅', '💅'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, EmojiSkinTone.Type3),
        expected
      );
    });
  });

  describe('canBeSynced', () => {
    it('returns false for non-arrays', () => {
      assert.isFalse(canBeSynced(undefined));
      assert.isFalse(canBeSynced(null));
      assert.isFalse(canBeSynced('❤️👍🏼👎🏼😂😮😢'));
    });

    it('returns false for arrays that are too long', () => {
      assert.isFalse(canBeSynced(Array(21).fill('🦊')));
    });

    it('returns false for arrays that have items that are too long', () => {
      const input = ['✨', '❇️', 'x'.repeat(21), '🦈', '💖', '🅿️'];
      assert.isFalse(canBeSynced(input));
    });

    it('returns true for valid values', () => {
      [
        [],
        ['💅'],
        ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'],
        ['this', 'array', 'has', 'no', 'emoji', 'but', "that's", 'okay'],
      ].forEach(input => {
        assert.isTrue(canBeSynced(input));
      });
    });
  });
});
