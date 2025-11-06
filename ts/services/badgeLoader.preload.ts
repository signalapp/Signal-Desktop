// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

import type { BadgesStateType } from '../state/ducks/badges.preload.js';

export async function loadBadges(): Promise<void> {
  // No-op stub
}

export function getBadgesForRedux(): BadgesStateType {
  return { byId: {} };
}
