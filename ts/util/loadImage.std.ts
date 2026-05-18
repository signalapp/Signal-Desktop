// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { explodePromise } from './explodePromise.std.ts';

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const { promise, resolve, reject } = explodePromise<void>();

  // FIXME
  // oxlint-disable-next-line no-undef
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.addEventListener('load', () => resolve(), { once: true });
  img.addEventListener(
    'error',
    () => reject(new Error('Image failed to load')),
    { once: true }
  );
  img.src = src;

  await promise;

  return img;
}
