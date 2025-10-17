// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { nativeImage } from 'electron';
import type { NativeImage } from 'electron';
import { join } from 'node:path';

export function getAppErrorIcon(): NativeImage {
  const iconPath = join(
    __dirname,
    '..',
    '..',
    'images',
    'app-icon-with-error.png'
  );
  return nativeImage.createFromPath(iconPath);
}
