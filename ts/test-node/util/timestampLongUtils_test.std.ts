// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getSafeLongFromTimestamp,
  getTimestampFromLong,
  getTimestampOrUndefinedFromLong,
  getCheckedTimestampFromLong,
  getCheckedTimestampOrUndefinedFromLong,
} from '../../util/timestampLongUtils.std.js';
import { MAX_SAFE_DATE } from '../../util/timestamp.std.js';
import { MAX_VALUE } from '../../util/long.std.js';

import { toNumber } from '../../util/toNumber.std.js';

describe('getSafeLongFromTimestamp', () => {
  it('returns zero when passed undefined', () => {
    assert.strictEqual(getSafeLongFromTimestamp(undefined), 0n);
  });

  it('returns the number as a Long when passed a "normal" number', () => {
    assert.strictEqual(getSafeLongFromTimestamp(0), 0n);
    assert.strictEqual(getSafeLongFromTimestamp(123).toString(), '123');
    assert.strictEqual(getSafeLongFromTimestamp(-456).toString(), '-456');
  });

  it('returns MAX_SAFE_DATE when passed Infinity', () => {
    assert.strictEqual(
      toNumber(getSafeLongFromTimestamp(Infinity)),
      MAX_SAFE_DATE
    );
  });

  it('returns MAX_VALUE when passed Infinity and overriden', () => {
    assert.strictEqual(
      getSafeLongFromTimestamp(Infinity, MAX_VALUE),
      MAX_VALUE
    );
  });

  it("returns MAX_SAFE_DATE when passed very large numbers, outside of JavaScript's safely representable range", () => {
    assert.strictEqual(
      toNumber(getSafeLongFromTimestamp(Number.MAX_VALUE)),
      MAX_SAFE_DATE
    );
  });
});

describe('getTimestampFromLong', () => {
  it('returns zero when passed negative Long', () => {
    assert.equal(getTimestampFromLong(BigInt(-1)), 0);
  });

  it('returns zero when passed 0 Long', () => {
    assert.equal(getTimestampFromLong(0n), 0);
  });

  it('returns MAX_SAFE_DATE when passed MAX_VALUE', () => {
    assert.equal(getTimestampFromLong(MAX_VALUE), MAX_SAFE_DATE);
  });

  it('returns a normal number', () => {
    assert.equal(getTimestampFromLong(16n), 16);
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
    assert.throws(() => getCheckedTimestampFromLong(BigInt(-1)));
  });

  it('throws on MAX_VALUE', () => {
    assert.throws(() => getCheckedTimestampFromLong(MAX_VALUE));
  });

  it('does not throw otherwise', () => {
    assert.equal(getCheckedTimestampFromLong(16n), 16);
  });
});

describe('getTimestampOrUndefinedFromLong', () => {
  it('returns undefined when passed 0 Long', () => {
    assert.equal(getTimestampOrUndefinedFromLong(0n), undefined);
  });

  it('returns MAX_SAFE_DATE when passed MAX_VALUE', () => {
    assert.equal(getTimestampOrUndefinedFromLong(MAX_VALUE), MAX_SAFE_DATE);
  });

  it('returns a normal number', () => {
    assert.equal(getTimestampOrUndefinedFromLong(16n), 16);
  });

  it('returns undefined for null value', () => {
    assert.equal(getTimestampOrUndefinedFromLong(null), undefined);
  });
});

describe('getCheckedTimestampOrUndefinedFromLong', () => {
  it('throws on negative Long', () => {
    assert.throws(() => getCheckedTimestampOrUndefinedFromLong(-1n));
  });

  it('returns undefined on absent Long', () => {
    assert.equal(getCheckedTimestampOrUndefinedFromLong(null), undefined);
  });

  it('returns undefined on zero Long', () => {
    assert.equal(getCheckedTimestampOrUndefinedFromLong(0n), undefined);
  });

  it('returns a normal number', () => {
    assert.equal(getCheckedTimestampOrUndefinedFromLong(16n), 16);
  });
});
