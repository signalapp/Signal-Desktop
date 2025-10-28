// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isSorted } from '../../util/isSorted.std.js';

describe('isSorted', () => {
  it('returns true for empty lists', () => {
    assert.isTrue(isSorted([]));
  });

  it('returns true for one-element lists', () => {
    assert.isTrue(isSorted([5]));
  });

  it('returns true for sorted lists', () => {
    assert.isTrue(isSorted([1, 2]));
    assert.isTrue(isSorted([1, 2, 2, 3]));
  });

  it('returns false for out-of-order lists', () => {
    assert.isFalse(isSorted([2, 1]));
    assert.isFalse(isSorted([1, 2, 2, 3, 0]));
  });
});
