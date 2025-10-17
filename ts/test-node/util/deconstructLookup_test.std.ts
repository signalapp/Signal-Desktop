// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { deconstructLookup } from '../../util/deconstructLookup.std.js';

describe('deconstructLookup', () => {
  it('looks up an array of properties in a lookup', () => {
    const lookup = {
      high: 5,
      seven: 89,
      big: 999,
    };
    const keys = ['seven', 'high'];

    assert.deepEqual(deconstructLookup(lookup, keys), [89, 5]);
  });
});
