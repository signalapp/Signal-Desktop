// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { normalizeGroupCallTimestamp } from '../../../util/ringrtc/normalizeGroupCallTimestamp';

describe('normalizeGroupCallTimestamp', () => {
  it('returns undefined if passed NaN', () => {
    assert.isUndefined(normalizeGroupCallTimestamp(NaN));
  });

  it('returns undefined if passed 0', () => {
    assert.isUndefined(normalizeGroupCallTimestamp(0));
    assert.isUndefined(normalizeGroupCallTimestamp(-0));
  });

  it('returns undefined if passed a negative number', () => {
    assert.isUndefined(normalizeGroupCallTimestamp(-1));
    assert.isUndefined(normalizeGroupCallTimestamp(-123));
  });

  it('returns undefined if passed a string that cannot be parsed as a number', () => {
    assert.isUndefined(normalizeGroupCallTimestamp(''));
    assert.isUndefined(normalizeGroupCallTimestamp('uhhh'));
  });

  it('returns undefined if passed a BigInt of 0', () => {
    assert.isUndefined(normalizeGroupCallTimestamp(BigInt(0)));
  });

  it('returns undefined if passed a negative BigInt', () => {
    assert.isUndefined(normalizeGroupCallTimestamp(BigInt(-1)));
    assert.isUndefined(normalizeGroupCallTimestamp(BigInt(-123)));
  });

  it('returns undefined if passed a non-parseable type', () => {
    [
      undefined,
      null,
      {},
      [],
      [123],
      Symbol('123'),
      { [Symbol.toPrimitive]: () => 123 },
      // eslint-disable-next-line no-new-wrappers
      new Number(123),
    ].forEach(value => {
      assert.isUndefined(normalizeGroupCallTimestamp(value));
    });
  });

  it('returns positive numbers passed in', () => {
    assert.strictEqual(normalizeGroupCallTimestamp(1), 1);
    assert.strictEqual(normalizeGroupCallTimestamp(123), 123);
  });

  it('parses strings as numbers', () => {
    assert.strictEqual(normalizeGroupCallTimestamp('1'), 1);
    assert.strictEqual(normalizeGroupCallTimestamp('123'), 123);
  });

  it('only parses the first 15 characters of a string', () => {
    assert.strictEqual(
      normalizeGroupCallTimestamp('12345678901234567890123456789'),
      123456789012345
    );
  });

  it('converts positive BigInts to numbers', () => {
    assert.strictEqual(normalizeGroupCallTimestamp(BigInt(1)), 1);
    assert.strictEqual(normalizeGroupCallTimestamp(BigInt(123)), 123);
  });
});
