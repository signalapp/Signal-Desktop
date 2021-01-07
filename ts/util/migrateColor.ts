// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ColorType } from '../types/Colors';

export function migrateColor(color?: string): ColorType {
  switch (color) {
    // These colors no longer exist
    case 'orange':
    case 'amber':
      return 'deep_orange';
    case 'yellow':
      return 'brown';
    case 'deep_purple':
      return 'purple';
    case 'light_blue':
      return 'blue';
    case 'cyan':
      return 'teal';
    case 'lime':
      return 'light_green';

    // These can stay as they are
    case 'red':
    case 'deep_orange':
    case 'brown':
    case 'pink':
    case 'purple':
    case 'indigo':
    case 'blue':
    case 'teal':
    case 'green':
    case 'light_green':
    case 'blue_grey':
    case 'grey':
    case 'ultramarine':
      return color;

    default:
      return 'grey';
  }
}
