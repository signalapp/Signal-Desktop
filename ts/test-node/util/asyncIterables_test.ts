// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { MaybeAsyncIterable } from '../../util/asyncIterables';
import { concat, wrapPromise } from '../../util/asyncIterables';

describe('async iterable utilities', () => {
  describe('concat', () => {
    it('returns an empty async iterable if called with an empty list', async () => {
      const result = concat([]);

      assert.isEmpty(await collect(result));
    });

    it('concatenates synchronous and asynchronous iterables', async () => {
      function* makeSync() {
        yield 'sync 1';
        yield 'sync 2';
      }
      async function* makeAsync() {
        yield 'async 1';
        yield 'async 2';
      }

      const syncIterable: Iterable<string> = makeSync();
      const asyncIterable1: AsyncIterable<string> = makeAsync();
      const asyncIterable2: AsyncIterable<string> = makeAsync();

      const result = concat([
        syncIterable,
        asyncIterable1,
        ['array 1', 'array 2'],
        asyncIterable2,
      ]);

      assert.deepEqual(await collect(result), [
        'sync 1',
        'sync 2',
        'async 1',
        'async 2',
        'array 1',
        'array 2',
        'async 1',
        'async 2',
      ]);
    });
  });

  describe('wrapPromise', () => {
    it('resolves to an array when wrapping a synchronous iterable', async () => {
      const iterable = new Set([1, 2, 3]);

      const result = wrapPromise(Promise.resolve(iterable));
      assert.sameMembers(await collect(result), [1, 2, 3]);
    });

    it('resolves to an array when wrapping an asynchronous iterable', async () => {
      const iterable = (async function* () {
        yield 1;
        yield 2;
        yield 3;
      })();

      const result = wrapPromise(Promise.resolve(iterable));
      assert.deepEqual(await collect(result), [1, 2, 3]);
    });
  });
});

/**
 * Turns an iterable into a fully-realized array.
 *
 * If we want this outside of tests, we could make it into a "real" function.
 */
async function collect<T>(iterable: MaybeAsyncIterable<T>): Promise<Array<T>> {
  const result: Array<T> = [];
  for await (const value of iterable) {
    result.push(value);
  }
  return result;
}
