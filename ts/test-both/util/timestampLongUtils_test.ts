// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';

import {
  getSafeLongFromTimestamp,
  getTimestampFromLong,
  getTimestampOrUndefinedFromLong,
  getCheckedTimestampFromLong,
  getCheckedTimestampOrUndefinedFromLong,
} from '../../util/timestampLongUtils';
import { MAX_SAFE_DATE } from '../../util/timestamp';

describe('getSafeLongFromTimestamp', () => {
  it('returns zero when passed undefined', () => {
    assert(getSafeLongFromTimestamp(undefined).isZero());
  });

  it('returns the number as a Long when passed a "normal" number', () => {
    assert(getSafeLongFromTimestamp(0).isZero());
    assert.strictEqual(getSafeLongFromTimestamp(123).toString(), '123');
    assert.strictEqual(getSafeLongFromTimestamp(-456).toString(), '-456');
  });

  it('returns MAX_SAFE_DATE when passed Infinity', () => {
    assert.strictEqual(
      getSafeLongFromTimestamp(Infinity).toNumber(),
      MAX_SAFE_DATE
    );
  });

  it('returns Long.MAX_VALUE when passed Infinity and overriden', () => {
    assert(
      getSafeLongFromTimestamp(Infinity, Long.MAX_VALUE).equals(Long.MAX_VALUE)
    );
  });

  it("returns MAX_SAFE_DATE when passed very large numbers, outside of JavaScript's safely representable range", () => {
    assert.strictEqual(
      getSafeLongFromTimestamp(Number.MAX_VALUE).toNumber(),
      MAX_SAFE_DATE
    );
  });
});

describe('getTimestampFromLong', () => {
  it('returns zero when passed negative Long', () => {
    assert.equal(getTimestampFromLong(Long.fromNumber(-1)), 0);
  });

  it('returns zero when passed 0 Long', () => {
    assert.equal(getTimestampFromLong(Long.fromNumber(0)), 0);
  });

  it('returns MAX_SAFE_DATE when passed Long.MAX_VALUE', () => {
    assert.equal(getTimestampFromLong(Long.MAX_VALUE), MAX_SAFE_DATE);
  });

  it('returns a normal number', () => {
    assert.equal(getTimestampFromLong(Long.fromNumber(16)), 16);
  });

  it('returns 0 for null value', () => {
    assert.equal(getTimestampFromLong(null), 0);
  });
});

describe('getCheckedTimestampFromLong', () => {
  it('throws on absent Long', () => {
    assert.throws(() => getCheckedTimestampFromLong(null));
  });

  it('throws on negative Long', () => {
    assert.throws(() => getCheckedTimestampFromLong(Long.fromNumber(-1)));
  });

  it('throws on Long.MAX_VALUE', () => {
    assert.throws(() => getCheckedTimestampFromLong(Long.MAX_VALUE));
  });

  it('does not throw otherwise', () => {
    assert.equal(getCheckedTimestampFromLong(Long.fromNumber(16)), 16);
  });
});

describe('getTimestampOrUndefinedFromLong', () => {
  it('returns undefined when passed 0 Long', () => {
    assert.equal(
      getTimestampOrUndefinedFromLong(Long.fromNumber(0)),
      undefined
    );
  });

  it('returns MAX_SAFE_DATE when passed Long.MAX_VALUE', () => {
    assert.equal(
      getTimestampOrUndefinedFromLong(Long.MAX_VALUE),
      MAX_SAFE_DATE
    );
  });

  it('returns a normal number', () => {
    assert.equal(getTimestampOrUndefinedFromLong(Long.fromNumber(16)), 16);
  });

  it('returns undefined for null value', () => {
    assert.equal(getTimestampOrUndefinedFromLong(null), undefined);
  });
});

describe('getCheckedTimestampOrUndefinedFromLong', () => {
  it('throws on negative Long', () => {
    assert.throws(() =>
      getCheckedTimestampOrUndefinedFromLong(Long.fromNumber(-1))
    );
  });

  it('returns undefined on absent Long', () => {
    assert.equal(getCheckedTimestampOrUndefinedFromLong(null), undefined);
  });

  it('returns undefined on zero Long', () => {
    assert.equal(getCheckedTimestampOrUndefinedFromLong(Long.ZERO), undefined);
  });

  it('returns a normal number', () => {
    assert.equal(
      getCheckedTimestampOrUndefinedFromLong(Long.fromNumber(16)),
      16
    );
  });
});
