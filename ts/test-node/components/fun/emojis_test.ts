// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { getEmojifyData } from '../../../components/fun/data/emojis.std.js';

describe('getEmojifyData', () => {
  function check(text: string, emojiCount: number, isEmojiOnlyText: boolean) {
    assert.deepEqual(getEmojifyData(text), {
      text,
      emojiCount,
      isEmojiOnlyText,
    });
  }

  it('empty strings', () => check('', 0, false));
  it('no emojis', () => check('abc', 0, false));
  it('emoji-like chars', () => check('®', 0, false));
  it('one emoji', () => check('❤️', 1, true));
  it('multiple emojis', () => check('❤️❤️❤️', 3, true));
  it('emojis + leading text', () => check('leading❤️', 1, false));
  it('emojis + trailing text', () => check('❤️trailing', 1, false));
  it('emojis + middle text', () => check('❤️middle❤️', 2, false));
  it('lots of emoji', () => check('❤️'.repeat(1000), 1000, true));
  it('lots of text + emoji', () => check(`${'a'.repeat(1000)}❤️`, 1, false));
});
