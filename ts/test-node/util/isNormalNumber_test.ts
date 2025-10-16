// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isNormalNumber } from '../../util/isNormalNumber.std.js';

describe('isNormalNumber', () => {
  it('returns false for non-numbers', () => {
    assert.isFalse(isNormalNumber(undefined));
    assert.isFalse(isNormalNumber(null));
    assert.isFalse(isNormalNumber('123'));
    assert.isFalse(isNormalNumber(BigInt(123)));
  });

  it('returns false for Number objects, which should never be used', () => {
    // eslint-disable-next-line no-new-wrappers
    assert.isFalse(isNormalNumber(new Number(123)));
  });

  it('returns false for values that can be converted to numbers', () => {
    const obj = {
      [Symbol.toPrimitive]() {
        return 123;
      },
    };
    assert.isFalse(isNormalNumber(obj));
  });

  it('returns false for NaN', () => {
    assert.isFalse(isNormalNumber(NaN));
  });

  it('returns false for Infinity', () => {
    assert.isFalse(isNormalNumber(Infinity));
    assert.isFalse(isNormalNumber(-Infinity));
  });

  it('returns true for other numbers', () => {
    assert.isTrue(isNormalNumber(123));
    assert.isTrue(isNormalNumber(0));
    assert.isTrue(isNormalNumber(-1));
    assert.isTrue(isNormalNumber(0.12));
  });
});
