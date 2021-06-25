// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { canvasToBlob } from './canvasToBlob';

export async function canvasToArrayBuffer(
  canvas: HTMLCanvasElement
): Promise<ArrayBuffer> {
  const blob = await canvasToBlob(canvas);
  return blob.arrayBuffer();
}
