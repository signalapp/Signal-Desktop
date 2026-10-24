// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AvatarColors } from '../types/Avatar.std.ts';
import type { AvatarColorType } from '../types/Avatar.std.ts';
import { generateAvatarColor } from '../Crypto.node.ts';

const NEW_COLOR_NAMES = new Set(AvatarColors);

export function migrateColor(
  color: string | undefined,
  options: Parameters<typeof generateAvatarColor>[0]
): AvatarColorType {
  if (color && NEW_COLOR_NAMES.has(color as AvatarColorType)) {
    return color as AvatarColorType;
  }

  return generateAvatarColor(options);
}
