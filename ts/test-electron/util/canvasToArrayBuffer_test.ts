// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { canvasToArrayBuffer } from '../../util/canvasToArrayBuffer';

describe('canvasToArrayBuffer', () => {
  it('converts a canvas to an ArrayBuffer', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 200;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Test setup error: cannot get canvas rendering context');
    }
    context.fillStyle = '#ff9900';
    context.fillRect(10, 10, 20, 20);

    const result = await canvasToArrayBuffer(canvas);

    // These are just smoke tests.
    assert.instanceOf(result, ArrayBuffer);
    assert.isAtLeast(result.byteLength, 50);
  });
});
