// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

import type { BadgeType } from '../badges/types.std.js';

export async function loadBadges(): Promise<void> {
  // No-op stub
}

export async function getBadgesForRedux(): Promise<Array<BadgeType>> {
  return [];
}
