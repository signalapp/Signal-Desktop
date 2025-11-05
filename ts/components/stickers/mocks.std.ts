// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stickers feature removed
// This file exists as a stub to prevent import errors during the transition

import type { StickerPackType, StickerType } from '../../state/ducks/stickers.preload.js';

export const createPack = (props: Partial<StickerPackType> = {}): StickerPackType => ({
  id: '',
  key: '',
  title: '',
  author: '',
  coverStickerId: 0,
  createdAt: 0,
  downloadAttempts: 0,
  status: 'known',
  stickerCount: 0,
  stickers: [], // UI type uses array, not Record
  storageNeedsSync: false,
  isBlessed: false,
  ...props,
});

export const packs: Array<StickerPackType> = [];
export const recentStickers: Array<StickerType> = [];
