// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { AvatarColorType } from '../types/Colors.std.js';
import { AvatarColors } from '../types/Colors.std.js';

const { sample } = lodash;

export function getRandomColor(): AvatarColorType {
  return sample(AvatarColors) || AvatarColors[0];
}
