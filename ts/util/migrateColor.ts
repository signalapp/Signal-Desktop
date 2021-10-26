// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sample } from 'lodash';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';

const NEW_COLOR_NAMES = new Set(AvatarColors);

export function migrateColor(color?: string): AvatarColorType {
  if (color && NEW_COLOR_NAMES.has(color)) {
    return color;
  }

  return sample(AvatarColors) || AvatarColors[0];
}
