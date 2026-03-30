// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { replaceEmojiWithSpaces, splitByEmoji } from '../../util/emoji.std.ts';

describe('emoji', () => {
  describe('replaceEmojiWithSpaces', () => {
    it('replaces emoji and pictograms with a single space', () => {
      assert.strictEqual(
        replaceEmojiWithSpaces('hello🌀🐀🔀😀world'),
        'hello    world'
      );
    });

    it('leaves regular text as it is', () => {
      assert.strictEqual(
        replaceEmojiWithSpaces('Привет 嘿 հեյ העלא مرحبا '),
        'Привет 嘿 հեյ העלא مرحبا '
      );
    });
  });

  describe('splitByEmoji', () => {
    it('replaces emoji and pictograms with a single space', () => {
      assert.deepStrictEqual(splitByEmoji('hello😛world😎😛!'), [
        { type: 'text', value: 'hello' },
        { type: 'emoji', value: '😛' },
        { type: 'text', value: 'world' },
        { type: 'emoji', value: '😎' },
        { type: 'emoji', value: '😛' },
        { type: 'text', value: '!' },
      ]);
    });

    it('returns emojis as text after 5,000 emojis are found', () => {
      assert.deepStrictEqual(splitByEmoji('💬'.repeat(5002)), [
        ...Array(5000).fill({ type: 'emoji', value: '💬' }),
        { type: 'text', value: '💬💬' },
      ]);
    });
  });
});
