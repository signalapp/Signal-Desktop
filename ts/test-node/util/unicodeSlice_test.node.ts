// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import { unicodeSlice } from '../../util/unicodeSlice.std.js';
import { byteLength } from '../../Bytes.std.js';

describe('unicodeSlice()', () => {
  function test(
    title: string,
    input: string,
    begin: number,
    end: number,
    expected: string,
    expectedSize: number
  ): void {
    it(title, () => {
      const result = unicodeSlice(input, begin, end);
      assert.strictEqual(result, expected);
      assert.strictEqual(byteLength(result), expectedSize);
    });
  }

  test('one-byte chars', '123456', 2, 4, '34', 2);
  test('past max length', '123456', 0, 100, '123456', 6);
  test('end before start', '123456', 5, 1, '', 0);
  test('negative start', '123456', -5, 4, '1234', 4);
  test('negative end', '123456', 0, -5, '', 0);
  test('end at start', '123456', 3, 3, '', 0);

  test('multi-byte char', 'x€x', 1, 4, '€', 3);
  test('multi-byte char slice before end', '€', 1, 3, '', 0);
  test('multi-byte char slice after start', '€', 2, 4, '', 0);
  test('ignores utf-16 length', '€123', 0, 4, '€1', 4);

  test('emoji', 'x👩‍👩‍👧‍👦x', 1, 26, '👩‍👩‍👧‍👦', 25);
  test('emoji slice before end', 'x👩‍👩‍👧‍👦x', 1, 25, '', 0);
  test('emoji slice after start', 'x👩‍👩‍👧‍👦x', 2, 26, '', 0);
  test('emoji slice capture around', 'x👩‍👩‍👧‍👦x', 0, 27, 'x👩‍👩‍👧‍👦x', 27);
});
