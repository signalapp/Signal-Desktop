// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { generateConfigMatrix } from '../../util/generateConfigMatrix';

describe('generateConfigMatrix', () => {
  it('generates an empty list', () => {
    assert.deepStrictEqual(generateConfigMatrix({}), []);

    assert.deepStrictEqual(
      generateConfigMatrix({
        prop1: [],
        prop2: [],
      }),
      []
    );
  });

  it('generates a single-element list', () => {
    assert.deepStrictEqual(
      generateConfigMatrix({
        prop1: ['a'],
        prop2: ['b'],
      }),
      [
        {
          prop1: 'a',
          prop2: 'b',
        },
      ]
    );
  });

  it('generates multiple permutations', () => {
    assert.deepStrictEqual(
      generateConfigMatrix({
        prop1: ['a', 'b'],
        prop2: ['c', 'd'],
      }),
      [
        { prop1: 'a', prop2: 'c' },
        { prop1: 'b', prop2: 'c' },
        { prop1: 'a', prop2: 'd' },
        { prop1: 'b', prop2: 'd' },
      ]
    );
  });
});
