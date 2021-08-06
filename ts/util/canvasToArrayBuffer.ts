// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { canvasToBlob } from './canvasToBlob';
import { MIMEType } from '../types/MIME';

export async function canvasToArrayBuffer(
  canvas: HTMLCanvasElement,
  mimeType?: MIMEType,
  quality?: number
): Promise<ArrayBuffer> {
  const blob = await canvasToBlob(canvas, mimeType, quality);
  return blob.arrayBuffer();
}
