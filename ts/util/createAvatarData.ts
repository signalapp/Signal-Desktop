// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as uuid } from 'uuid';
import type { AvatarDataType } from '../types/Avatar.std.js';

export function createAvatarData(
  partialAvatarData: Readonly<Omit<AvatarDataType, 'id'>>
): AvatarDataType {
  return {
    id: uuid(),
    ...partialAvatarData,
  };
}
