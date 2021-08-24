// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { canvasToArrayBuffer } from './canvasToArrayBuffer';

export async function imagePathToArrayBuffer(
  src: string
): Promise<ArrayBuffer> {
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

  const result = await canvasToArrayBuffer(canvas);
  return result;
}
