// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { groupBy } from '../../util/mapUtil';

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
});
