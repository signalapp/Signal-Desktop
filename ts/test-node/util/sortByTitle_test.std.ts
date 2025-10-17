// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { sortByTitle } from '../../util/sortByTitle.std.js';

describe('sortByTitle', () => {
  it("does nothing to arrays that don't need to be sorted", () => {
    assert.deepEqual(sortByTitle([]), []);

    assert.deepEqual(sortByTitle([{ title: 'foo' }]), [{ title: 'foo' }]);
  });

  it('sorts the array by title', () => {
    // Because the function relies on locale-aware comparisons, we don't have very
    //   thorough tests here, as it can change based on platform.
    assert.deepEqual(sortByTitle([{ title: 'foo' }, { title: 'bar' }]), [
      { title: 'bar' },
      { title: 'foo' },
    ]);
  });

  it("doesn't mutate its argument", () => {
    const arr = [{ title: 'foo' }, { title: 'bar' }];
    sortByTitle(arr);
    assert.deepEqual(arr, [{ title: 'foo' }, { title: 'bar' }]);
  });
});
