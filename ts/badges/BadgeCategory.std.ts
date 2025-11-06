// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

export enum BadgeCategory {
  Donor = 'donor',
  Other = 'other',
}

export const parseBadgeCategory = (value: unknown): BadgeCategory => {
  return BadgeCategory.Other;
};
