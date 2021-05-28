// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AvatarColorType } from '../types/Colors';

export function migrateColor(color?: string): AvatarColorType {
  switch (color) {
    // These colors no longer exist
    case 'orange':
    case 'amber':
      return 'vermilion';
    case 'yellow':
      return 'burlap';
    case 'deep_purple':
      return 'violet';
    case 'light_blue':
      return 'blue';
    case 'cyan':
      return 'teal';
    case 'lime':
      return 'wintergreen';

    // Actual color names
    case 'red':
      return 'crimson';
    case 'deep_orange':
      return 'vermilion';
    case 'brown':
      return 'burlap';
    case 'pink':
      return 'plum';
    case 'purple':
      return 'violet';
    case 'green':
      return 'forest';
    case 'light_green':
      return 'wintergreen';
    case 'blue_grey':
      return 'steel';
    case 'grey':
      return 'steel';

    // These can stay as they are
    case 'blue':
    case 'indigo':
    case 'teal':
    case 'ultramarine':
      return color;

    default:
      return 'steel';
  }
}
