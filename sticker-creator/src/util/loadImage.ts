// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import b64 from 'base64-js';

export function loadImage(data: Uint8Array): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Bad image')));
    image.src = `data:image/jpeg;base64,${b64.fromByteArray(data)}`;
  });
}
