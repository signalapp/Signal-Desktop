// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { rgbIntToHSL, rgbToHSL } from '../../util/rgbToHSL';

describe('rgbToHSL', () => {
  it('converts pure rgb colors', () => {
    assert.deepStrictEqual(rgbToHSL(255, 0, 0), {
      h: 0,
      s: 1,
      l: 0.5,
    });

    assert.deepStrictEqual(rgbToHSL(0, 255, 0), {
      h: 120,
      s: 1,
      l: 0.5,
    });

    assert.deepStrictEqual(rgbToHSL(0, 0, 255), {
      h: 240,
      s: 1,
      l: 0.5,
    });
  });

  it('converts random sampled rgb colors', () => {
    assert.deepStrictEqual(rgbToHSL(27, 132, 116), {
      h: 170.85714285714283,
      s: 0.6603773584905662,
      l: 0.31176470588235294,
    });

    assert.deepStrictEqual(rgbToHSL(27, 175, 82), {
      h: 142.2972972972973,
      s: 0.7326732673267328,
      l: 0.396078431372549,
    });
  });
});

describe('rgbIntToHSL', () => {
  it('converts pure rgb colors', () => {
    assert.deepStrictEqual(rgbIntToHSL(4294901760), { h: 0, s: 1, l: 0.5 });
    assert.deepStrictEqual(rgbIntToHSL(4278255360), { h: 120, s: 1, l: 0.5 });
    assert.deepStrictEqual(rgbIntToHSL(4278190335), { h: 240, s: 1, l: 0.5 });
  });
});
