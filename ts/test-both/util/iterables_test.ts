// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { isIterable, size, map, take } from '../../util/iterables';

describe('iterable utilities', () => {
  describe('isIterable', () => {
    it('returns false for non-iterables', () => {
      assert.isFalse(isIterable(undefined));
      assert.isFalse(isIterable(null));
      assert.isFalse(isIterable(123));
      assert.isFalse(isIterable({ foo: 'bar' }));
      assert.isFalse(
        isIterable({
          length: 2,
          '0': 'fake',
          '1': 'array',
        })
      );
    });

    it('returns true for iterables', () => {
      assert.isTrue(isIterable('strings are iterable'));
      assert.isTrue(isIterable(['arrays too']));
      assert.isTrue(isIterable(new Set('and sets')));
      assert.isTrue(isIterable(new Map([['and', 'maps']])));
      assert.isTrue(
        isIterable({
          [Symbol.iterator]() {
            return {
              next() {
                return {
                  value: 'endless iterable',
                  done: false,
                };
              },
            };
          },
        })
      );
      assert.isTrue(
        isIterable(
          (function* generators() {
            yield 123;
          })()
        )
      );
    });
  });

  describe('size', () => {
    it('returns the length of a string', () => {
      assert.strictEqual(size(''), 0);
      assert.strictEqual(size('hello world'), 11);
    });

    it('returns the length of an array', () => {
      assert.strictEqual(size([]), 0);
      assert.strictEqual(size(['hello', 'world']), 2);
    });

    it('returns the size of a set', () => {
      assert.strictEqual(size(new Set()), 0);
      assert.strictEqual(size(new Set([1, 2, 3])), 3);
    });

    it('returns the length (not byte length) of typed arrays', () => {
      assert.strictEqual(size(new Uint8Array(3)), 3);
      assert.strictEqual(size(new Uint32Array(3)), 3);
    });

    it('returns the size of arbitrary iterables', () => {
      function* someNumbers() {
        yield 3;
        yield 6;
        yield 9;
      }
      assert.strictEqual(size(someNumbers()), 3);
    });
  });

  describe('map', () => {
    it('returns an empty iterable when passed an empty iterable', () => {
      const fn = sinon.fake();

      assert.deepEqual([...map([], fn)], []);
      assert.deepEqual([...map(new Set(), fn)], []);
      assert.deepEqual([...map(new Map(), fn)], []);

      sinon.assert.notCalled(fn);
    });

    it('returns a new iterator with values mapped', () => {
      const fn = sinon.fake((n: number) => n * n);
      const result = map([1, 2, 3], fn);

      sinon.assert.notCalled(fn);

      assert.deepEqual([...result], [1, 4, 9]);
      assert.notInstanceOf(result, Array);

      sinon.assert.calledThrice(fn);
    });

    it('iterating doesn\'t "spend" the iterable', () => {
      const result = map([1, 2, 3], n => n * n);

      assert.deepEqual([...result], [1, 4, 9]);
      assert.deepEqual([...result], [1, 4, 9]);
      assert.deepEqual([...result], [1, 4, 9]);
    });

    it('can map over an infinite iterable', () => {
      const everyNumber = {
        *[Symbol.iterator]() {
          for (let i = 0; true; i += 1) {
            yield i;
          }
        },
      };

      const fn = sinon.fake((n: number) => n * n);
      const result = map(everyNumber, fn);
      const iterator = result[Symbol.iterator]();

      assert.deepEqual(iterator.next(), { value: 0, done: false });
      assert.deepEqual(iterator.next(), { value: 1, done: false });
      assert.deepEqual(iterator.next(), { value: 4, done: false });
      assert.deepEqual(iterator.next(), { value: 9, done: false });
    });
  });

  describe('take', () => {
    it('returns the first n elements from an iterable', () => {
      const everyNumber = {
        *[Symbol.iterator]() {
          for (let i = 0; true; i += 1) {
            yield i;
          }
        },
      };

      assert.deepEqual([...take(everyNumber, 0)], []);
      assert.deepEqual([...take(everyNumber, 1)], [0]);
      assert.deepEqual([...take(everyNumber, 7)], [0, 1, 2, 3, 4, 5, 6]);
    });

    it('stops after the iterable has been exhausted', () => {
      const set = new Set([1, 2, 3]);

      assert.deepEqual([...take(set, 3)], [1, 2, 3]);
      assert.deepEqual([...take(set, 4)], [1, 2, 3]);
      assert.deepEqual([...take(set, 10000)], [1, 2, 3]);
    });
  });
});
