// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { IMAGE_JPEG, IMAGE_PNG } from '../../types/MIME';
import { sniffImageMimeType } from '../../util/sniffImageMimeType';

import { canvasToArrayBuffer } from '../../util/canvasToArrayBuffer';

describe('canvasToArrayBuffer', () => {
  let canvas: HTMLCanvasElement;
  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 200;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Test setup error: cannot get canvas rendering context');
    }
    context.fillStyle = '#ff9900';
    context.fillRect(10, 10, 20, 20);
  });

  it('converts a canvas to an ArrayBuffer, JPEG by default', async () => {
    const result = await canvasToArrayBuffer(canvas);

    assert.strictEqual(sniffImageMimeType(result), IMAGE_JPEG);

    // These are just smoke tests.
    assert.instanceOf(result, ArrayBuffer);
    assert.isAtLeast(result.byteLength, 50);
  });

  it('can convert a canvas to a PNG ArrayBuffer', async () => {
    const result = await canvasToArrayBuffer(canvas, IMAGE_PNG);

    assert.strictEqual(sniffImageMimeType(result), IMAGE_PNG);
  });
});
