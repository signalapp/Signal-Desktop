// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { formatCountForLogging } from '../../logging/formatCountForLogging.std.js';

describe('formatCountForLogging', () => {
  it('returns "0" if passed zero', () => {
    assert.strictEqual(formatCountForLogging(0), '0');
  });

  it('returns "NaN" if passed NaN', () => {
    assert.strictEqual(formatCountForLogging(0 / 0), 'NaN');
  });

  it('returns "at least X", where X is a power of 10, for other numbers', () => {
    assert.strictEqual(formatCountForLogging(1), 'at least 1');
    assert.strictEqual(formatCountForLogging(2), 'at least 1');
    assert.strictEqual(formatCountForLogging(9), 'at least 1');
    assert.strictEqual(formatCountForLogging(10), 'at least 10');
    assert.strictEqual(formatCountForLogging(99), 'at least 10');
    assert.strictEqual(formatCountForLogging(100), 'at least 100');
    assert.strictEqual(formatCountForLogging(999), 'at least 100');
    assert.strictEqual(formatCountForLogging(1000), 'at least 1000');
    assert.strictEqual(formatCountForLogging(9999), 'at least 1000');
  });
});
