// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { makeLookup } from '../../util/makeLookup.std.js';

describe('makeLookup', () => {
  it('returns an empty object if passed an empty array', () => {
    const result = makeLookup([], 'foo');

    assert.deepEqual(result, {});
  });

  it('returns an object that lets you look up objects by string key', () => {
    const arr = [{ foo: 'bar' }, { foo: 'baz' }, { foo: 'qux' }];
    const result = makeLookup(arr, 'foo');

    assert.hasAllKeys(result, ['bar', 'baz', 'qux']);
    assert.strictEqual(result.bar, arr[0]);
    assert.strictEqual(result.baz, arr[1]);
    assert.strictEqual(result.qux, arr[2]);
  });

  it('if there are duplicates, the last one wins', () => {
    const arr = [
      { foo: 'bar', first: true },
      { foo: 'bar', first: false },
    ];
    const result = makeLookup(arr, 'foo');

    assert.deepEqual(result, {
      bar: { foo: 'bar', first: false },
    });
  });

  it('ignores undefined properties', () => {
    const arr = [{}, { foo: undefined }];
    const result = makeLookup(arr, 'foo');

    assert.deepEqual(result, {});
  });

  it('allows key of 0', () => {
    const arr = [{}, { id: 0 }, { id: 1 }, { id: 2 }];
    const result = makeLookup(arr, 'id');

    assert.deepEqual(result, {
      0: { id: 0 },
      1: { id: 1 },
      2: { id: 2 },
    });
  });

  it('converts the lookup to a string', () => {
    const arr = [
      { foo: 'bar' },
      { foo: 123 },
      { foo: {} },
      {
        foo: {
          toString() {
            return 'baz';
          },
        },
      },
      {},
    ];
    const result = makeLookup(arr, 'foo');

    assert.hasAllKeys(result, ['bar', '123', '[object Object]', 'baz']);
    assert.strictEqual(result.bar, arr[0]);
    assert.strictEqual(result['123'], arr[1]);
    assert.strictEqual(result['[object Object]'], arr[2]);
    assert.strictEqual(result.baz, arr[3]);
  });

  it('looks up own and inherited properties', () => {
    const prototype = { foo: 'baz' };

    const arr = [{ foo: 'bar' }, Object.create(prototype)];
    const result = makeLookup(arr, 'foo');

    assert.strictEqual(result.bar, arr[0]);
    assert.strictEqual(result.baz, arr[1]);
  });
});
