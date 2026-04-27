// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { AvatarColorType } from '../types/Colors.std.ts';
import { AvatarColors } from '../types/Colors.std.ts';

const { sample } = lodash;

export function getRandomColor(): AvatarColorType {
  // oxlint-disable-next-line typescript/no-non-null-assertion
  return sample(AvatarColors) || AvatarColors[0]!;
}
