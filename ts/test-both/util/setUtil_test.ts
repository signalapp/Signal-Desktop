// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { difference, isEqual, remove, toggle } from '../../util/setUtil';

describe('set utilities', () => {
  const original = new Set([1, 2, 3]);

  describe('isEqual', () => {
    it('returns false if the sets are different', () => {
      const sets = [
        new Set([1, 2, 3]),
        new Set([1, 2, 3, 4]),
        new Set([1, 2]),
        new Set([4, 5, 6]),
      ];

      for (const a of sets) {
        for (const b of sets) {
          if (a !== b) {
            assert.isFalse(isEqual(a, b));
          }
        }
      }
    });

    it('returns true if both arguments are the same set', () => {
      const set = new Set([1, 2, 3]);
      assert.isTrue(isEqual(set, set));
    });

    it('returns true if the sets have the same values', () => {
      assert.isTrue(isEqual(new Set(), new Set()));
      assert.isTrue(isEqual(new Set([1, 2]), new Set([2, 1])));
    });
  });

  describe('remove', () => {
    it('accepts zero arguments, returning a new set', () => {
      const result = remove(original);
      assert.deepStrictEqual(result, original);
      assert.notStrictEqual(result, original);
    });

    it('accepts 1 argument, returning a new set', () => {
      const result = remove(original, 2);
      assert.deepStrictEqual(result, new Set([1, 3]));
      assert.deepStrictEqual(original, new Set([1, 2, 3]));
    });

    it('accepts multiple arguments, returning a new set', () => {
      const result = remove(original, 1, 2, 99);
      assert.deepStrictEqual(result, new Set([3]));
      assert.deepStrictEqual(original, new Set([1, 2, 3]));
    });
  });

  describe('toggle', () => {
    it('returns a clone if trying to remove an item that was never there', () => {
      const result = toggle(original, 99, false);
      assert.deepStrictEqual(result, new Set([1, 2, 3]));
      assert.notStrictEqual(result, original);
    });

    it('returns a clone if trying to add an item that was already there', () => {
      const result = toggle(original, 3, true);
      assert.deepStrictEqual(result, new Set([1, 2, 3]));
      assert.notStrictEqual(result, original);
    });

    it('can add an item to a set', () => {
      const result = toggle(original, 4, true);
      assert.deepStrictEqual(result, new Set([1, 2, 3, 4]));
      assert.deepStrictEqual(original, new Set([1, 2, 3]));
    });

    it('can remove an item from a set', () => {
      const result = toggle(original, 2, false);
      assert.deepStrictEqual(result, new Set([1, 3]));
      assert.deepStrictEqual(original, new Set([1, 2, 3]));
    });
  });

  describe('difference', () => {
    it('returns the difference of two sets', () => {
      assert.deepStrictEqual(
        difference(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c'])),
        new Set()
      );
      assert.deepStrictEqual(
        difference(new Set(['a', 'b', 'c']), new Set([])),
        new Set(['a', 'b', 'c'])
      );
      assert.deepStrictEqual(
        difference(new Set(['a', 'b', 'c']), new Set(['d'])),
        new Set(['a', 'b', 'c'])
      );
    });
  });
});
