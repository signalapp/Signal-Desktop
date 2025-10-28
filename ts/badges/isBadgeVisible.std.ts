// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BadgeType } from './types.std.js';

export const isBadgeVisible = (badge: Readonly<BadgeType>): boolean =>
  'isVisible' in badge ? badge.isVisible : true;
