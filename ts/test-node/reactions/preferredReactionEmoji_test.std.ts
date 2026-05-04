// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  canBeSynced,
  getPreferredReactionEmoji,
} from '../../reactions/preferredReactionEmoji.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

describe('preferred reaction emoji utilities', () => {
  describe('getPreferredReactionEmoji', () => {
    const defaultsForSkinTone2 = Emoji.getDefaultPreferredReactionEmojis(
      Emoji.SkinTone.Type2
    );

    it('returns the default set if passed an empty array', () => {
      assert.deepStrictEqual(
        getPreferredReactionEmoji([], Emoji.SkinTone.Type2),
        defaultsForSkinTone2
      );
    });

    it('falls back to defaults if passed an array that is too short', () => {
      const input = ['✨', '❇️'];
      const expected = ['✨', '❇️', '👎🏽', '😂', '😮', '😢'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, Emoji.SkinTone.Type3),
        expected
      );
    });

    it('falls back to defaults when passed an array with some invalid values', () => {
      const input = [
        '✨',
        'invalid',
        '🎇',
        '🦈',
        undefined,
        '',
      ] as Array<Emoji.Variant>;
      const expected = ['✨', '👍🏼', '🎇', '🦈', '😮', '😢'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, Emoji.SkinTone.Type2),
        expected
      );
    });

    it('returns a custom set if passed a valid value', () => {
      const input = ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, Emoji.SkinTone.Type3),
        input
      );
    });

    it('only returns the first few emoji if passed a value that is too long', () => {
      const expected = ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'];
      const input = [...expected, '💅', '💅', '💅', '💅'];
      assert.deepStrictEqual(
        getPreferredReactionEmoji(input, Emoji.SkinTone.Type3),
        expected
      );
    });
  });

  describe('canBeSynced', () => {
    it('returns false for non-arrays', () => {
      assert.isFalse(canBeSynced(undefined));
      assert.isFalse(canBeSynced(null as unknown as Array<string>));
      assert.isFalse(canBeSynced('❤️👍🏼👎🏼😂😮😢' as unknown as Array<string>));
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
