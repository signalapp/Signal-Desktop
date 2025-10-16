// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { parseIntOrThrow } from '../../util/parseIntOrThrow.std.js';

describe('parseIntOrThrow', () => {
  describe('when passed a number argument', () => {
    it('returns the number when passed an integer', () => {
      assert.strictEqual(parseIntOrThrow(0, "shouldn't happen"), 0);
      assert.strictEqual(parseIntOrThrow(123, "shouldn't happen"), 123);
      assert.strictEqual(parseIntOrThrow(-123, "shouldn't happen"), -123);
    });

    it('throws when passed a decimal value', () => {
      assert.throws(() => parseIntOrThrow(0.2, 'uh oh'), 'uh oh');
      assert.throws(() => parseIntOrThrow(1.23, 'uh oh'), 'uh oh');
    });

    it('throws when passed NaN', () => {
      assert.throws(() => parseIntOrThrow(NaN, 'uh oh'), 'uh oh');
    });

    it('throws when passed ∞', () => {
      assert.throws(() => parseIntOrThrow(Infinity, 'uh oh'), 'uh oh');
      assert.throws(() => parseIntOrThrow(-Infinity, 'uh oh'), 'uh oh');
    });
  });

  describe('when passed a string argument', () => {
    it('returns the number when passed an integer', () => {
      assert.strictEqual(parseIntOrThrow('0', "shouldn't happen"), 0);
      assert.strictEqual(parseIntOrThrow('123', "shouldn't happen"), 123);
      assert.strictEqual(parseIntOrThrow('-123', "shouldn't happen"), -123);
    });

    it('parses decimal values like parseInt', () => {
      assert.strictEqual(parseIntOrThrow('0.2', "shouldn't happen"), 0);
      assert.strictEqual(parseIntOrThrow('12.34', "shouldn't happen"), 12);
      assert.strictEqual(parseIntOrThrow('-12.34', "shouldn't happen"), -12);
    });

    it('parses values in base 10', () => {
      assert.strictEqual(parseIntOrThrow('0x12', "shouldn't happen"), 0);
    });

    it('throws when passed non-parseable strings', () => {
      assert.throws(() => parseIntOrThrow('', 'uh oh'), 'uh oh');
      assert.throws(() => parseIntOrThrow('uh 123', 'uh oh'), 'uh oh');
      assert.throws(() => parseIntOrThrow('uh oh', 'uh oh'), 'uh oh');
    });
  });

  describe('when passed other arguments', () => {
    it("throws when passed arguments that aren't strings or numbers", () => {
      assert.throws(() => parseIntOrThrow(null, 'uh oh'), 'uh oh');
      assert.throws(() => parseIntOrThrow(undefined, 'uh oh'), 'uh oh');
      assert.throws(() => parseIntOrThrow(['123'], 'uh oh'), 'uh oh');
    });

    it('throws when passed a stringifiable argument, unlike parseInt', () => {
      const obj = {
        toString() {
          return '123';
        },
      };
      assert.throws(() => parseIntOrThrow(obj, 'uh oh'), 'uh oh');
    });
  });
});
