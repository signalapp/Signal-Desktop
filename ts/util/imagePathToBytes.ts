// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { canvasToBytes } from './canvasToBytes.std.js';

export async function imagePathToBytes(src: string): Promise<Uint8Array> {
  const image = new Image();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(
      'imagePathToArrayBuffer: could not get canvas rendering context'
    );
  }

  image.src = src;
  await image.decode();

  canvas.width = image.width;
  canvas.height = image.height;

  context.drawImage(image, 0, 0);

  return canvasToBytes(canvas);
}
