// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { IMAGE_JPEG, IMAGE_PNG } from '../../types/MIME.std.js';
import { sniffImageMimeType } from '../../util/sniffImageMimeType.std.js';

import { canvasToBlob } from '../../util/canvasToBlob.std.js';

describe('canvasToBlob', () => {
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

  it('converts a canvas to an Blob, JPEG by default', async () => {
    const result = await canvasToBlob(canvas);

    assert.strictEqual(
      sniffImageMimeType(new Uint8Array(await result.arrayBuffer())),
      IMAGE_JPEG
    );

    // These are just smoke tests.
    assert.instanceOf(result, Blob);
    assert.isAtLeast(result.size, 50);
  });

  it('can convert a canvas to a PNG Blob', async () => {
    const result = await canvasToBlob(canvas, IMAGE_PNG);

    assert.strictEqual(
      sniffImageMimeType(new Uint8Array(await result.arrayBuffer())),
      IMAGE_PNG
    );
  });
});
