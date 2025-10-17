// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { groupBy, isEqual } from '../../util/mapUtil.std.js';

describe('map utilities', () => {
  describe('groupBy', () => {
    it('returns an empty map when passed an empty iterable', () => {
      const fn = sinon.fake();

      assert.isEmpty(groupBy([], fn));

      sinon.assert.notCalled(fn);
    });

    it('groups the iterable', () => {
      assert.deepEqual(
        groupBy([2.3, 1.3, 2.9, 1.1, 3.4], Math.floor),
        new Map([
          [1, [1.3, 1.1]],
          [2, [2.3, 2.9]],
          [3, [3.4]],
        ])
      );
    });
  });

  describe('isEqual', () => {
    it('returns false on different maps', () => {
      assert.isFalse(
        isEqual<string, number>(new Map([]), new Map([['key', 1]]))
      );

      assert.isFalse(
        isEqual<string, number>(new Map([['key', 0]]), new Map([['key', 1]]))
      );

      assert.isFalse(
        isEqual<string, number>(
          new Map([
            ['key', 1],
            ['another-key', 2],
          ]),
          new Map([['key', 1]])
        )
      );
    });

    it('returns true on equal maps', () => {
      assert.isTrue(isEqual<string, number>(new Map([]), new Map([])));
      assert.isTrue(
        isEqual<string, number>(new Map([['key', 1]]), new Map([['key', 1]]))
      );
      assert.isTrue(
        isEqual<string, number>(
          new Map([
            ['a', 1],
            ['b', 2],
          ]),
          new Map([
            ['b', 2],
            ['a', 1],
          ])
        )
      );
    });
  });
});
