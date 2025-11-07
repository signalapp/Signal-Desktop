// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badges feature removed for Orbital
// This file provides stub badge data to maintain compatibility

export type BadgeImageTheme = 'light' | 'dark';

export type BadgeImageType = {
  url: string;
  transparent?: {
    url: string;
  };
  light?: {
    localPath?: string;
    url: string;
  };
  dark?: {
    localPath?: string;
    url: string;
  };
};

export type BadgeType = {
  id: string;
  category: string;
  name: string;
  descriptionTemplate: string;
  images: BadgeImageType[];
};

export function parseBadgeCategory(_value: string): string {
  return 'other';
}

export function parseBadgeImageTheme(theme: string): BadgeImageTheme {
  return theme === 'dark' ? 'dark' : 'light';
}

export function parseBadgesFromServer(_badges: unknown[]): BadgeType[] {
  return [];
}

export function parseBoostBadgeListFromServer(_badges: unknown[]): BadgeType[] {
  return [];
}
