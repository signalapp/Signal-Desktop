// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed in Orbital cleanup
// Minimal types preserved for backward compatibility

export type BadgeType = {
  id: string;
  category: string;
  name: string;
  descriptionTemplate: string;
  images: ReadonlyArray<BadgeImageType>;
  expiresAt?: number;
  isVisible?: boolean;
};

export type BadgeImageType = Record<string, BadgeImageFileType>;

export type BadgeImageFileType = {
  localPath?: string;
  url: string;
};
