// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import type { NativeImage } from 'electron';
import { nativeImage } from 'electron';

export function getUnreadIcon(unreadCount: number): NativeImage {
  const filename =
    unreadCount > 9 ? '9-plus.png' : `${String(unreadCount)}.png`;
  const path = join(__dirname, '..', '..', 'images', 'unread-icon', filename);
  // if path does not exist, this returns an empty NativeImage
  return nativeImage.createFromPath(path);
}

export function getMarkedUnreadIcon(): NativeImage {
  const path = join(
    __dirname,
    '..',
    '..',
    'images',
    'unread-icon',
    'marked-unread.png'
  );
  return nativeImage.createFromPath(path);
}
