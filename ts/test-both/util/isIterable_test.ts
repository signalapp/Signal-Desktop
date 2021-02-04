// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isIterable } from '../../util/isIterable';

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
