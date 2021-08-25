// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { replaceEmojiWithSpaces, splitByEmoji } from '../../util/emoji';

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
        { type: 'text', value: '' },
        { type: 'emoji', value: '😛' },
        { type: 'text', value: '!' },
      ]);
    });

    it('should return empty string after split at the end', () => {
      assert.deepStrictEqual(splitByEmoji('hello😛'), [
        { type: 'text', value: 'hello' },
        { type: 'emoji', value: '😛' },
        { type: 'text', value: '' },
      ]);
    });

    it('should return empty string before the split at the start', () => {
      assert.deepStrictEqual(splitByEmoji('😛hello'), [
        { type: 'text', value: '' },
        { type: 'emoji', value: '😛' },
        { type: 'text', value: 'hello' },
      ]);
    });
  });
});
