// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { mapObjectWithSpec } from '../../util/mapObjectWithSpec.std.js';

describe('mapObjectWithSpec', () => {
  const increment = (value: number) => value + 1;

  it('maps a single key/value pair', () => {
    assert.deepStrictEqual(mapObjectWithSpec('a', { a: 1 }, increment), {
      a: 2,
    });
  });

  it('maps a multiple key/value pairs', () => {
    assert.deepStrictEqual(
      mapObjectWithSpec(['a', 'b'], { a: 1, b: 2 }, increment),
      { a: 2, b: 3 }
    );
  });

  it('maps a key with a value spec', () => {
    assert.deepStrictEqual(
      mapObjectWithSpec(
        {
          key: 'a',
          valueSpec: ['b', 'c'],
        },
        { a: { b: 1, c: 2 } },
        increment
      ),
      { a: { b: 2, c: 3 } }
    );
  });

  it('maps a map with a value spec', () => {
    assert.deepStrictEqual(
      mapObjectWithSpec(
        {
          isMap: true,
          valueSpec: ['b', 'c'],
        },
        {
          key1: { b: 1, c: 2 },
          key2: { b: 3, c: 4 },
        },
        increment
      ),
      {
        key1: { b: 2, c: 3 },
        key2: { b: 4, c: 5 },
      }
    );
  });

  it('map undefined to undefined', () => {
    assert.deepStrictEqual(
      mapObjectWithSpec('a', undefined, increment),
      undefined
    );
  });
});
