// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AvatarDataType } from '../types/Avatar.std.js';

export function isSameAvatarData(
  a?: AvatarDataType,
  b?: AvatarDataType
): boolean {
  if (!a || !b) {
    return false;
  }
  if (a.buffer && b.buffer) {
    return a.buffer === b.buffer;
  }
  if (a.imagePath && b.imagePath) {
    return a.imagePath === b.imagePath;
  }
  return a.id === b.id;
}
