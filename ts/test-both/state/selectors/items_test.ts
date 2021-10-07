// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  getEmojiSkinTone,
  getPinnedConversationIds,
  getPreferredReactionEmoji,
} from '../../../state/selectors/items';
import type { StateType } from '../../../state/reducer';
import type { ItemsStateType } from '../../../state/ducks/items';

describe('both/state/selectors/items', () => {
  // Note: we would like to use the full reducer here, to get a real empty state object
  //   but we cannot load the full reducer inside of electron-mocha.
  function getRootState(items: ItemsStateType): StateType {
    return {
      items,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  describe('#getEmojiSkinTone', () => {
    it('returns 0 if passed anything invalid', () => {
      [
        // Invalid types
        undefined,
        null,
        '2',
        [2],
        // Numbers out of range
        -1,
        6,
        Infinity,
        // Invalid numbers
        0.1,
        1.2,
        NaN,
      ].forEach(skinTone => {
        const state = getRootState({ skinTone });
        assert.strictEqual(getEmojiSkinTone(state), 0);
      });
    });

    it('returns all valid skin tones', () => {
      [0, 1, 2, 3, 4, 5].forEach(skinTone => {
        const state = getRootState({ skinTone });
        assert.strictEqual(getEmojiSkinTone(state), skinTone);
      });
    });
  });

  describe('#getPinnedConversationIds', () => {
    it('returns pinnedConversationIds key from items', () => {
      const expected = ['one', 'two'];
      const state: StateType = getRootState({
        pinnedConversationIds: expected,
      });

      const actual = getPinnedConversationIds(state);
      assert.deepEqual(actual, expected);
    });

    it('returns empty array if no saved data', () => {
      const expected: Array<string> = [];
      const state = getRootState({});

      const actual = getPinnedConversationIds(state);
      assert.deepEqual(actual, expected);
    });
  });

  describe('#getPreferredReactionEmoji', () => {
    // See also: the tests for the `getPreferredReactionEmoji` helper.

    const expectedDefault = ['❤️', '👍🏿', '👎🏿', '😂', '😮', '😢'];

    it('returns the default set if no value is stored', () => {
      const state = getRootState({ skinTone: 5 });
      const actual = getPreferredReactionEmoji(state);

      assert.deepStrictEqual(actual, expectedDefault);
    });

    it('returns the default set if the stored value is invalid', () => {
      const state = getRootState({
        skinTone: 5,
        preferredReactionEmoji: ['garbage!!'],
      });
      const actual = getPreferredReactionEmoji(state);

      assert.deepStrictEqual(actual, expectedDefault);
    });

    it('returns a custom set of emoji', () => {
      const preferredReactionEmoji = ['✨', '❇️', '🤙🏻', '🦈', '💖', '🅿️'];
      const state = getRootState({ skinTone: 5, preferredReactionEmoji });
      const actual = getPreferredReactionEmoji(state);

      assert.deepStrictEqual(actual, preferredReactionEmoji);
    });
  });
});
