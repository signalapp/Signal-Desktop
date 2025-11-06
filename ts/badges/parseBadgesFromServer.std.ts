// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

import { z } from 'zod';
import type { BadgeType } from './types.std.js';

// Stub schema for badge from server
export const badgeFromServerSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  sprites6: z.array(z.string()).optional(),
});

export function parseBadgesFromServer(
  _badges: unknown,
  _updatesUrl: string
): Array<BadgeType> {
  return [];
}

export function parseBoostBadgeListFromServer(
  _badges: unknown,
  _updatesUrl: string
): Array<BadgeType> {
  return [];
}
