// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { makeEnumParser } from '../util/enum.std.js';

export enum BadgeImageTheme {
  Light = 'light',
  Dark = 'dark',
  Transparent = 'transparent',
}

export const parseBadgeImageTheme = makeEnumParser(
  BadgeImageTheme,
  BadgeImageTheme.Transparent
);
