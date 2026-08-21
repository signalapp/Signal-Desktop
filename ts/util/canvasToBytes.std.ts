// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { canvasToBlob } from './canvasToBlob.std.ts';
import type { MIMEType } from '../types/MIME.std.ts';

export async function canvasToBytes(
  canvas: HTMLCanvasElement,
  mimeType?: MIMEType
): Promise<Uint8Array<ArrayBuffer>> {
  const blob = await canvasToBlob(canvas, mimeType);
  return new Uint8Array(await blob.arrayBuffer());
}
