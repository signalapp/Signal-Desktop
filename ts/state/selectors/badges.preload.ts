// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed for Orbital
// This file provides stub implementations to maintain type compatibility

export type BadgeType = {
  id: string;
  category: string;
  name: string;
  descriptionTemplate: string;
  images: Array<unknown>;
};

// Stub selector that returns undefined for all badge queries
export const getPreferredBadgeSelector = () => undefined;

// Additional stub functions for compatibility
export function getBadgesSelector(): readonly BadgeType[] {
  return [];
}

export function getPreferredBadge(
  _badges: ReadonlyArray<BadgeType> | undefined
): BadgeType | undefined {
  return undefined;
}
