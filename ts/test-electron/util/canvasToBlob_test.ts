// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { canvasToBlob } from '../../util/canvasToBlob';

describe('canvasToBlob', () => {
  it('converts a canvas to an Blob', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 200;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Test setup error: cannot get canvas rendering context');
    }
    context.fillStyle = '#ff9900';
    context.fillRect(10, 10, 20, 20);

    const result = await canvasToBlob(canvas);

    // These are just smoke tests.
    assert.instanceOf(result, Blob);
    assert.isAtLeast(result.size, 50);
  });
});
