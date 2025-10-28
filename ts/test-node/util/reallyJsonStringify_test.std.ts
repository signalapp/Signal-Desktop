// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { reallyJsonStringify } from '../../util/reallyJsonStringify.std.js';

describe('reallyJsonStringify', () => {
  it('returns the same thing as JSON.stringify when JSON.stringify returns a string', () => {
    [
      null,
      true,
      false,
      0,
      -0,
      123,
      -Infinity,
      Infinity,
      NaN,
      '',
      'foo',
      [],
      [1],
      {},
      { hi: 5 },
      new Date(),
      new Set([1, 2, 3]),
      new Map([['foo', 'bar']]),
      Promise.resolve(123),
      {
        toJSON() {
          return 'foo';
        },
      },
    ].forEach(value => {
      const expected = JSON.stringify(value);
      const actual = reallyJsonStringify(value);

      assert.strictEqual(actual, expected);
      assert.isString(actual);
    });
  });

  it('returns a string when JSON.stringify returns undefined', () => {
    const check = (value: unknown, expected: string): void => {
      const actual = reallyJsonStringify(value);
      assert.strictEqual(actual, expected);
      // This ensures that our test is set up correctly, not the code under test.
      assert.isUndefined(JSON.stringify(value));
    };

    check(undefined, '[object Undefined]');
    check(Symbol('foo'), '[object Symbol]');
    check(
      {
        toJSON() {
          return undefined;
        },
      },
      '[object Object]'
    );
  });

  it('returns a string when JSON.stringify would error', () => {
    const check = (value: unknown, expected: string): void => {
      const actual = reallyJsonStringify(value);
      assert.strictEqual(actual, expected);
      // This ensures that our test is set up correctly, not the code under test.
      assert.throws(() => JSON.stringify(value));
    };

    check(BigInt(123), '[object BigInt]');

    const a: Record<string, unknown> = {};
    const b = { a };
    a.b = b;
    check(a, '[object Object]');

    check([a], '[object Array]');

    const bad = {
      toJSON() {
        throw new Error("don't even try to stringify me");
      },
    };
    check(bad, '[object Object]');
    check([bad], '[object Array]');
  });
});
