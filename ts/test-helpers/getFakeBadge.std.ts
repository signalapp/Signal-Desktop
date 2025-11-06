// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

import type { BadgeType } from '../badges/types.std.js';
import { BadgeCategory } from '../badges/BadgeCategory.std.js';

export function getFakeBadge(overrides: Partial<BadgeType> = {}): BadgeType {
  return {
    id: 'TEST_BADGE',
    category: BadgeCategory.Other,
    name: 'Test Badge',
    descriptionTemplate: 'Test badge description',
    images: [],
    ...overrides,
  };
}
