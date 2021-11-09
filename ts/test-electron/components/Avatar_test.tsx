// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { _getBadgePlacement } from '../../components/Avatar';

describe('<Avatar>', () => {
  describe('_getBadgePlacement', () => {
    const check = (
      testCases: Map<number, ReturnType<typeof _getBadgePlacement>>
    ) => {
      for (const [input, expected] of testCases.entries()) {
        const actual = _getBadgePlacement(input);
        assert.deepStrictEqual(
          actual,
          expected,
          `Invalid result for size ${input}`
        );
      }
    };

    it('returns values as specified by designs', () => {
      const testCases = new Map([
        [28, { size: 16, bottom: -4, right: -2 }],
        [36, { size: 16, bottom: -3, right: 0 }],
        [40, { size: 24, bottom: -6, right: -4 }],
        [48, { size: 24, bottom: -6, right: -4 }],
        [56, { size: 24, bottom: -6, right: 0 }],
        [80, { size: 36, bottom: -8, right: 0 }],
        [88, { size: 36, bottom: -4, right: 3 }],
      ]);
      check(testCases);
    });

    it('returns fallback values for sizes not specified by designs', () => {
      const testCases = new Map([
        [16, { size: 7, bottom: 0, right: 0 }],
        [200, { size: 85, bottom: 0, right: 0 }],
      ]);
      check(testCases);
    });
  });
});
