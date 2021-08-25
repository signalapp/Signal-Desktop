// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import {
  concat,
  filter,
  find,
  groupBy,
  isEmpty,
  isIterable,
  map,
  reduce,
  repeat,
  size,
  take,
  zipObject,
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

  describe('repeat', () => {
    it('repeats the same value forever', () => {
      const result = repeat('foo');

      const truncated = [...take(result, 10)];
      assert.deepEqual(truncated, Array(10).fill('foo'));
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

  describe('find', () => {
    const isOdd = (n: number) => Boolean(n % 2);

    it('returns undefined if the value is not found', () => {
      assert.isUndefined(find([], isOdd));
      assert.isUndefined(find([2, 4], isOdd));
    });

    it('returns the first matching value', () => {
      assert.strictEqual(find([0, 1, 2, 3], isOdd), 1);
    });

    it('only iterates until a value is found', () => {
      function* numbers() {
        yield 2;
        yield 3;
        throw new Error('this should never happen');
      }

      find(numbers(), isOdd);
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

  describe('isEmpty', () => {
    it('returns true for empty iterables', () => {
      assert.isTrue(isEmpty(''));
      assert.isTrue(isEmpty([]));
      assert.isTrue(isEmpty(new Set()));
    });

    it('returns false for non-empty iterables', () => {
      assert.isFalse(isEmpty(' '));
      assert.isFalse(isEmpty([1, 2]));
      assert.isFalse(isEmpty(new Set([3, 4])));
    });

    it('does not "look past" the first element', () => {
      function* numbers() {
        yield 1;
        throw new Error('this should never happen');
      }
      assert.isFalse(isEmpty(numbers()));
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

  describe('reduce', () => {
    it('returns the accumulator when passed an empty iterable', () => {
      const fn = sinon.fake();

      assert.strictEqual(reduce([], fn, 123), 123);

      sinon.assert.notCalled(fn);
    });

    it('iterates over the iterable, ultimately returning a result', () => {
      assert.strictEqual(
        reduce(new Set([1, 2, 3, 4]), (result, n) => result + n, 89),
        99
      );
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

  describe('zipObject', () => {
    it('zips up an object', () => {
      assert.deepEqual(zipObject(['foo', 'bar'], [1, 2]), { foo: 1, bar: 2 });
    });

    it('stops if the keys "run out" first', () => {
      assert.deepEqual(zipObject(['foo', 'bar'], [1, 2, 3, 4, 5, 6]), {
        foo: 1,
        bar: 2,
      });
    });

    it('stops if the values "run out" first', () => {
      assert.deepEqual(zipObject(['foo', 'bar', 'baz'], [1]), {
        foo: 1,
      });
    });
  });
});
