// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BadgeCategory } from './BadgeCategory.std.js';
import type { BadgeImageTheme } from './BadgeImageTheme.std.js';

type SomeoneElsesBadgeType = Readonly<{
  category: BadgeCategory;
  descriptionTemplate: string;
  id: string;
  images: ReadonlyArray<BadgeImageType>;
  name: string;
}>;

type OurBadgeType = SomeoneElsesBadgeType &
  Readonly<{
    expiresAt: number;
    isVisible: boolean;
  }>;

export type BadgeType = SomeoneElsesBadgeType | OurBadgeType;

export type BadgeImageType = Partial<
  Record<BadgeImageTheme, BadgeImageFileType>
>;

export type BadgeImageFileType = {
  localPath?: string;
  url: string;
};
