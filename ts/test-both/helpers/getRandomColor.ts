// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sample } from 'lodash';
import type { AvatarColorType } from '../../types/Colors';
import { AvatarColors } from '../../types/Colors';

export function getRandomColor(): AvatarColorType {
  return sample(AvatarColors) || AvatarColors[0];
}
