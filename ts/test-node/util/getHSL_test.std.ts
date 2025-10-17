// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getHSL } from '../../util/getHSL.std.js';

describe('getHSL', () => {
  it('returns expected lightness values', () => {
    const saturation = 100;
    assert.equal(getHSL({ hue: 0, saturation }), 'hsl(0, 100%, 45%)');
    assert.equal(getHSL({ hue: 60, saturation }), 'hsl(60, 100%, 30%)');
    assert.equal(getHSL({ hue: 90, saturation }), 'hsl(90, 100%, 30%)');
    assert.equal(getHSL({ hue: 180, saturation }), 'hsl(180, 100%, 30%)');
    assert.equal(getHSL({ hue: 240, saturation }), 'hsl(240, 100%, 50%)');
    assert.equal(getHSL({ hue: 300, saturation }), 'hsl(300, 100%, 40%)');
    assert.equal(getHSL({ hue: 360, saturation }), 'hsl(360, 100%, 45%)');
  });

  it('calculates lightness between values', () => {
    assert.equal(getHSL({ hue: 210, saturation: 100 }), 'hsl(210, 100%, 40%)');
  });
});
