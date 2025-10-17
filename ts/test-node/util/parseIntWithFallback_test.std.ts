// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { parseIntWithFallback } from '../../util/parseIntWithFallback.std.js';

describe('parseIntWithFallback', () => {
  describe('when passed a number argument', () => {
    it('returns the number when passed an integer', () => {
      assert.strictEqual(parseIntWithFallback(0, -1), 0);
      assert.strictEqual(parseIntWithFallback(123, -1), 123);
      assert.strictEqual(parseIntWithFallback(-123, -1), -123);
    });

    it('returns the fallback when passed a decimal value', () => {
      assert.strictEqual(parseIntWithFallback(0.2, -1), -1);
      assert.strictEqual(parseIntWithFallback(1.23, -1), -1);
    });

    it('returns the fallback when passed NaN', () => {
      assert.strictEqual(parseIntWithFallback(NaN, -1), -1);
    });

    it('returns the fallback when passed ∞', () => {
      assert.strictEqual(parseIntWithFallback(Infinity, -1), -1);
      assert.strictEqual(parseIntWithFallback(-Infinity, -1), -1);
    });
  });

  describe('when passed a string argument', () => {
    it('returns the number when passed an integer', () => {
      assert.strictEqual(parseIntWithFallback('0', -1), 0);
      assert.strictEqual(parseIntWithFallback('123', -1), 123);
      assert.strictEqual(parseIntWithFallback('-123', -1), -123);
    });

    it('parses decimal values like parseInt', () => {
      assert.strictEqual(parseIntWithFallback('0.2', -1), 0);
      assert.strictEqual(parseIntWithFallback('12.34', -1), 12);
      assert.strictEqual(parseIntWithFallback('-12.34', -1), -12);
    });

    it('parses values in base 10', () => {
      assert.strictEqual(parseIntWithFallback('0x12', -1), 0);
    });

    it('returns the fallback when passed non-parseable strings', () => {
      assert.strictEqual(parseIntWithFallback('', -1), -1);
      assert.strictEqual(parseIntWithFallback('uh 123', -1), -1);
      assert.strictEqual(parseIntWithFallback('uh oh', -1), -1);
    });
  });

  describe('when passed other arguments', () => {
    it("returns the fallback when passed arguments that aren't strings or numbers", () => {
      assert.strictEqual(parseIntWithFallback(null, -1), -1);
      assert.strictEqual(parseIntWithFallback(undefined, -1), -1);
      assert.strictEqual(parseIntWithFallback(['123'], -1), -1);
    });

    it('returns the fallback when passed a stringifiable argument, unlike parseInt', () => {
      const obj = {
        toString() {
          return '123';
        },
      };
      assert.strictEqual(parseIntWithFallback(obj, -1), -1);
    });
  });
});
