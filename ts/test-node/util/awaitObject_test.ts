// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { awaitObject } from '../../util/awaitObject.std.js';

describe('awaitObject', () => {
  it('returns correct result', async () => {
    assert.deepStrictEqual(
      await awaitObject({
        a: Promise.resolve(1),
        b: Promise.resolve('b'),
        c: Promise.resolve(null),
      }),
      {
        a: 1,
        b: 'b',
        c: null,
      }
    );
  });
});
