// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import {
  concat,
  filter,
  groupBy,
  isIterable,
  map,
  size,
  take,
} from '../../util/iterables';

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

  describe('concat', () => {
    it('returns an empty iterable when passed nothing', () => {
      assert.deepEqual([...concat()], []);
    });

    it('returns an empty iterable when passed empty iterables', () => {
      assert.deepEqual([...concat([])], []);
      assert.deepEqual([...concat(new Set())], []);
      assert.deepEqual([...concat(new Set(), [], new Map())], []);
    });

    it('concatenates multiple iterables', () => {
      const everyNumber = {
        *[Symbol.iterator]() {
          for (let i = 4; true; i += 1) {
            yield i;
          }
        },
      };

      const result = concat([1, 2], new Set([3]), [], everyNumber);
      const iterator = result[Symbol.iterator]();

      assert.deepEqual(iterator.next(), { value: 1, done: false });
      assert.deepEqual(iterator.next(), { value: 2, done: false });
      assert.deepEqual(iterator.next(), { value: 3, done: false });
      assert.deepEqual(iterator.next(), { value: 4, done: false });
      assert.deepEqual(iterator.next(), { value: 5, done: false });
      assert.deepEqual(iterator.next(), { value: 6, done: false });
      assert.deepEqual(iterator.next(), { value: 7, done: false });
    });

    it("doesn't start the iterable until the last minute", () => {
      const oneTwoThree = {
        [Symbol.iterator]: sinon.fake(() => {
          let n = 0;
          return {
            next() {
              if (n > 3) {
                return { done: true };
              }
              n += 1;
              return { value: n, done: false };
            },
          };
        }),
      };

      const result = concat([1, 2], oneTwoThree);
      const iterator = result[Symbol.iterator]();

      sinon.assert.notCalled(oneTwoThree[Symbol.iterator]);

      iterator.next();
      sinon.assert.notCalled(oneTwoThree[Symbol.iterator]);
      iterator.next();
      sinon.assert.notCalled(oneTwoThree[Symbol.iterator]);

      iterator.next();
      sinon.assert.calledOnce(oneTwoThree[Symbol.iterator]);

      iterator.next();
      sinon.assert.calledOnce(oneTwoThree[Symbol.iterator]);
    });
  });

  describe('filter', () => {
    it('returns an empty iterable when passed an empty iterable', () => {
      const fn = sinon.fake();

      assert.deepEqual([...filter([], fn)], []);
      assert.deepEqual([...filter(new Set(), fn)], []);
      assert.deepEqual([...filter(new Map(), fn)], []);

      sinon.assert.notCalled(fn);
    });

    it('returns a new iterator with some values removed', () => {
      const isOdd = sinon.fake((n: number) => Boolean(n % 2));
      const result = filter([1, 2, 3, 4], isOdd);

      sinon.assert.notCalled(isOdd);

      assert.deepEqual([...result], [1, 3]);
      assert.notInstanceOf(result, Array);

      sinon.assert.callCount(isOdd, 4);
    });

    it('can filter an infinite iterable', () => {
      const everyNumber = {
        *[Symbol.iterator]() {
          for (let i = 0; true; i += 1) {
            yield i;
          }
        },
      };

      const isOdd = (n: number) => Boolean(n % 2);
      const result = filter(everyNumber, isOdd);
      const iterator = result[Symbol.iterator]();

      assert.deepEqual(iterator.next(), { value: 1, done: false });
      assert.deepEqual(iterator.next(), { value: 3, done: false });
      assert.deepEqual(iterator.next(), { value: 5, done: false });
      assert.deepEqual(iterator.next(), { value: 7, done: false });
    });

    it('respects TypeScript type assertion signatures', () => {
      // This tests TypeScript, not the actual runtime behavior.
      function isString(value: unknown): value is string {
        return typeof value === 'string';
      }

      const input: Array<unknown> = [1, 'two', 3, 'four'];
      const result: Iterable<string> = filter(input, isString);

      assert.deepEqual([...result], ['two', 'four']);
    });
  });

  describe('groupBy', () => {
    it('returns an empty object if passed an empty iterable', () => {
      const fn = sinon.fake();

      assert.deepEqual(groupBy([], fn), {});
      assert.deepEqual(groupBy(new Set(), fn), {});

      sinon.assert.notCalled(fn);
    });

    it('returns a map of groups', () => {
      assert.deepEqual(
        groupBy(
          ['apple', 'aardvark', 'orange', 'orange', 'zebra'],
          str => str[0]
        ),
        {
          a: ['apple', 'aardvark'],
          o: ['orange', 'orange'],
          z: ['zebra'],
        }
      );
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
