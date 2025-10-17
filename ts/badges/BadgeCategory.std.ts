// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { makeEnumParser } from '../util/enum.std.js';

// The server may return "testing", which we should parse as "other".
export enum BadgeCategory {
  Donor = 'donor',
  Other = 'other',
}

export const parseBadgeCategory = makeEnumParser(
  BadgeCategory,
  BadgeCategory.Other
);
