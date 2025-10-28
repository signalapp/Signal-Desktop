// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { makeEnumParser } from '../../util/enum.std.js';

describe('enum utils', () => {
  describe('makeEnumParser', () => {
    enum Color {
      Red = 'red',
      Green = 'green',
      Blue = 'blue',
    }

    const parse = makeEnumParser(Color, Color.Blue);

    it('returns a parser that returns the default value if passed a non-string', () => {
      [undefined, null, 0, 1, 123].forEach(serializedValue => {
        const result: Color = parse(serializedValue);
        assert.strictEqual(result, Color.Blue);
      });
    });

    it('returns a parser that returns the default value if passed a string not in the enum', () => {
      ['', 'garbage', 'RED'].forEach(serializedValue => {
        const result: Color = parse(serializedValue);
        assert.strictEqual(result, Color.Blue);
      });
    });

    it('returns a parser that parses enum values', () => {
      const result: Color = parse('green');
      assert.strictEqual(result, Color.Green);
    });
  });
});
