// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function canvasToArrayBuffer(
  canvas: HTMLCanvasElement
): Promise<ArrayBuffer> {
  const blob: Blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Couldn't convert the canvas to a Blob"));
      }
    }, 'image/webp');
  });
  return blob.arrayBuffer();
}
