// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  _getBadgeSize,
  _getBadgePlacement,
} from '../../components/Avatar.dom.js';

describe('<Avatar>', () => {
  describe('_getBadgeSize', () => {
    it('returns undefined for sizes under 24px', () => {
      assert.isUndefined(_getBadgeSize(1));
      assert.isUndefined(_getBadgeSize(23));
    });

    it('returns 16px for sizes between 24px–36px', () => {
      assert.strictEqual(_getBadgeSize(24), 16);
      assert.strictEqual(_getBadgeSize(30), 16);
      assert.strictEqual(_getBadgeSize(36), 16);
    });

    it('returns 24px for sizes between 37px–64px', () => {
      assert.strictEqual(_getBadgeSize(37), 24);
      assert.strictEqual(_getBadgeSize(50), 24);
      assert.strictEqual(_getBadgeSize(64), 24);
    });

    it('returns 36px for sizes between 65px–112px', () => {
      assert.strictEqual(_getBadgeSize(65), 36);
      assert.strictEqual(_getBadgeSize(100), 36);
      assert.strictEqual(_getBadgeSize(112), 36);
    });

    it('returns ~40% of the size for sizes above 112px (a fallback)', () => {
      assert.strictEqual(_getBadgeSize(113), 45);
      assert.strictEqual(_getBadgeSize(200), 80);
      assert.strictEqual(_getBadgeSize(999), 400);
    });
  });

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
        [28, { bottom: -4, right: -2 }],
        [36, { bottom: -3, right: 0 }],
        [40, { bottom: -6, right: -4 }],
        [48, { bottom: -6, right: -4 }],
        [52, { bottom: -6, right: -2 }],
        [56, { bottom: -6, right: 0 }],
        [64, { bottom: -6, right: 0 }],
        [80, { bottom: -8, right: 0 }],
        [88, { bottom: -4, right: 3 }],
        [112, { bottom: -4, right: 3 }],
      ]);
      check(testCases);
    });

    it('returns 0, 0 values for sizes not specified by designs', () => {
      const testCases = new Map([
        [16, { bottom: 0, right: 0 }],
        [200, { bottom: 0, right: 0 }],
      ]);
      check(testCases);
    });
  });
});
