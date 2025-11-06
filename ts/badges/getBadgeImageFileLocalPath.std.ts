// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

import type { BadgeType } from './types.std.js';

export function getBadgeImageFileLocalPath(
  _badge: BadgeType | undefined,
  _size: number,
  _theme: string
): string | undefined {
  return undefined;
}
