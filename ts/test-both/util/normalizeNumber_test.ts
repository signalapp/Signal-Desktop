// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';

import { normalizeNumber } from '../../util/normalizeNumber';

describe('normalizeNumber', () => {
  it('returns undefined when input is undefined', () => {
    assert.isUndefined(normalizeNumber(undefined));
  });

  it('returns number when input is number', () => {
    assert.strictEqual(normalizeNumber(123), 123);
  });

  it('returns number when input is Long', () => {
    assert.strictEqual(normalizeNumber(new Long(123)), 123);
  });
});
