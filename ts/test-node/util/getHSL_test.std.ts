// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { calculateLightness } from '../../util/getHSL.std.ts';

describe('calculateLightness', () => {
  it('returns expected lightness values', () => {
    assert.equal(calculateLightness(0), 45);
    assert.equal(calculateLightness(60), 30);
    assert.equal(calculateLightness(90), 30);
    assert.equal(calculateLightness(180), 30);
    assert.equal(calculateLightness(240), 50);
    assert.equal(calculateLightness(300), 40);
    assert.equal(calculateLightness(360), 45);
  });

  it('calculates lightness between values', () => {
    assert.equal(calculateLightness(210), 40);
  });
});
