// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { hslToRGB, hslToRGBInt } from '../../util/hslToRGB';

describe('hslToRGB', () => {
  it('converts pure rgb colors', () => {
    assert.deepStrictEqual(hslToRGB(0, 1, 0.5), { r: 255, g: 0, b: 0 });
    assert.deepStrictEqual(hslToRGB(120, 1, 0.5), { r: 0, g: 255, b: 0 });
    assert.deepStrictEqual(hslToRGB(240, 1, 0.5), { r: 0, g: 0, b: 255 });
  });

  it('converts random sampled hsl colors', () => {
    assert.deepStrictEqual(hslToRGB(50, 0.233333, 0.41), {
      r: 129,
      g: 121,
      b: 80,
    });
    assert.deepStrictEqual(hslToRGB(170, 0.97, 0.1), {
      r: 1,
      g: 50,
      b: 42,
    });
  });
});

describe('hslToRGBInt', () => {
  it('converts pure rgb colors', () => {
    assert.equal(hslToRGBInt(0, 1, 0.5), 4294901760);
    assert.equal(hslToRGBInt(120, 1, 0.5), 4278255360);
    assert.equal(hslToRGBInt(240, 1, 0.5), 4278190335);
  });
});
