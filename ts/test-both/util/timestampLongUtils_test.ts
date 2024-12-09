// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';

import {
  getSafeLongFromTimestamp,
  getTimestampFromLong,
  getTimestampOrUndefinedFromLong,
} from '../../util/timestampLongUtils';

describe('getSafeLongFromTimestamp', () => {
  it('returns zero when passed undefined', () => {
    assert(getSafeLongFromTimestamp(undefined).isZero());
  });

  it('returns the number as a Long when passed a "normal" number', () => {
    assert(getSafeLongFromTimestamp(0).isZero());
    assert.strictEqual(getSafeLongFromTimestamp(123).toString(), '123');
    assert.strictEqual(getSafeLongFromTimestamp(-456).toString(), '-456');
  });

  it('returns Long.MAX_VALUE when passed Infinity', () => {
    assert(getSafeLongFromTimestamp(Infinity).equals(Long.MAX_VALUE));
  });

  it("returns Long.MAX_VALUE when passed very large numbers, outside of JavaScript's safely representable range", () => {
    assert.equal(getSafeLongFromTimestamp(Number.MAX_VALUE), Long.MAX_VALUE);
  });
});

describe('getTimestampFromLong', () => {
  it('returns zero when passed 0 Long', () => {
    assert.equal(getTimestampFromLong(Long.fromNumber(0)), 0);
  });

  it('returns Number.MAX_SAFE_INTEGER when passed Long.MAX_VALUE', () => {
    assert.equal(getTimestampFromLong(Long.MAX_VALUE), Number.MAX_SAFE_INTEGER);
  });

  it('returns a normal number', () => {
    assert.equal(getTimestampFromLong(Long.fromNumber(16)), 16);
  });

  it('returns 0 for null value', () => {
    assert.equal(getTimestampFromLong(null), 0);
  });
});

describe('getTimestampOrUndefinedFromLong', () => {
  it('returns undefined when passed 0 Long', () => {
    assert.equal(
      getTimestampOrUndefinedFromLong(Long.fromNumber(0)),
      undefined
    );
  });

  it('returns Number.MAX_SAFE_INTEGER when passed Long.MAX_VALUE', () => {
    assert.equal(
      getTimestampOrUndefinedFromLong(Long.MAX_VALUE),
      Number.MAX_SAFE_INTEGER
    );
  });

  it('returns a normal number', () => {
    assert.equal(getTimestampOrUndefinedFromLong(Long.fromNumber(16)), 16);
  });

  it('returns undefined for null value', () => {
    assert.equal(getTimestampOrUndefinedFromLong(null), undefined);
  });
});
