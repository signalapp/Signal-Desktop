// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getCustomColorStyle } from '../../util/getCustomColorStyle.dom.js';

describe('getCustomColorStyle', () => {
  it('returns undefined if no color passed in', () => {
    assert.isUndefined(getCustomColorStyle());
  });

  it('returns backgroundColor for solid colors', () => {
    const color = {
      start: {
        hue: 90,
        saturation: 100,
      },
    };

    assert.deepEqual(getCustomColorStyle(color), {
      backgroundColor: 'hsl(90, 100%, 30%)',
    });
  });

  it('returns backgroundImage with linear-gradient for gradients', () => {
    const color = {
      start: {
        hue: 90,
        saturation: 100,
      },
      end: {
        hue: 180,
        saturation: 50,
      },
      deg: 270,
    };

    assert.deepEqual(getCustomColorStyle(color), {
      backgroundImage:
        'linear-gradient(0deg, hsl(90, 100%, 30%), hsl(180, 50%, 30%))',
    });
  });
});
