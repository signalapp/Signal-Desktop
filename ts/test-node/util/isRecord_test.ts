// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isRecord } from '../../util/isRecord.std.js';

describe('isRecord', () => {
  it('returns false for primitives', () => {
    ['hello', 123, BigInt(123), true, undefined, Symbol('test'), null].forEach(
      value => {
        assert.isFalse(isRecord(value));
      }
    );
  });

  it('returns false for arrays', () => {
    assert.isFalse(isRecord([]));
  });

  it('returns true for "plain" objects', () => {
    assert.isTrue(isRecord({}));
    assert.isTrue(isRecord({ foo: 'bar' }));
    assert.isTrue(isRecord(Object.create(null)));
  });
});
