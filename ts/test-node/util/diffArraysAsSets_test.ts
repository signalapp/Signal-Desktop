// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { diffArraysAsSets } from '../../util/diffArraysAsSets';

function assertMatch<T>({
  added,
  removed,
}: {
  added: Array<T>;
  removed: Array<T>;
}) {
  return added.length === 0 && removed.length === 0;
}

describe('diffArraysAsSets', () => {
  it('returns true if arrays are both empty', () => {
    const left: Array<string> = [];
    const right: Array<string> = [];

    assertMatch(diffArraysAsSets(left, right));
  });

  it('returns true if arrays are equal', () => {
    const left = [1, 2, 3];
    const right = [1, 2, 3];

    assertMatch(diffArraysAsSets(left, right));
  });

  it('returns true if arrays are equal but out of order', () => {
    const left = [1, 2, 3];
    const right = [3, 1, 2];

    assertMatch(diffArraysAsSets(left, right));
  });

  it('returns true if arrays are equal but one has duplicates', () => {
    const left = [1, 2, 3, 1];
    const right = [1, 2, 3];

    assertMatch(diffArraysAsSets(left, right));
  });

  it('returns false if first array has missing elements', () => {
    const left = [1, 2];
    const right = [1, 2, 3];

    const { added, removed } = diffArraysAsSets(left, right);
    assert.deepEqual(added, [3]);
    assert.deepEqual(removed, []);
  });

  it('returns false if second array has missing elements', () => {
    const left = [1, 2, 3];
    const right = [1, 2];

    const { added, removed } = diffArraysAsSets(left, right);
    assert.deepEqual(added, []);
    assert.deepEqual(removed, [3]);
  });

  it('returns false if second array is empty', () => {
    const left = [1, 2, 3];
    const right: Array<number> = [];

    const { added, removed } = diffArraysAsSets(left, right);
    assert.deepEqual(added, []);
    assert.deepEqual(removed, [1, 2, 3]);
  });
});
