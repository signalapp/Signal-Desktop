// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup

export enum BadgeImageTheme {
  Transparent = 'transparent',
  Dark = 'dark',
  Light = 'light',
}

export function parseBadgeImageTheme(_value: unknown): BadgeImageTheme {
  return BadgeImageTheme.Transparent;
}
