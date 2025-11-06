// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stickers feature removed
// This file exists as a stub to prevent import errors during the transition

import type { StickerPackType as StickerPackDBType, StickerType as StickerDBType } from '../../sql/Interface.std';

// StickerType used in UI (simplified from DB type)
export type StickerType = {
  id: number;
  packId: string;
  emoji?: string;
  url: string;
};

// StickerPackType used in UI (transformed from DB type by selectors)
export type StickerPackType = Omit<StickerPackDBType, 'stickers'> & {
  isBlessed?: boolean;
  cover?: StickerType;
  stickers: ReadonlyArray<StickerType>; // Array in UI, Record in DB
};

// State stores DB types; selectors transform to UI types
export type StickersStateType = {
  packs: Record<string, StickerPackDBType>; // DB type in state
  recentStickers: ReadonlyArray<StickerDBType>; // DB type in state
  blessedPacks: ReadonlyArray<StickerPackDBType>; // DB type in state
  installedPack: string | null;
};

export const actions = {
  downloadStickerPack: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
  installStickerPack: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
  uninstallStickerPack: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
  clearInstalledStickerPack: () => ({ type: 'stickers/STUB' as const }),
  removeStickerPack: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
  useSticker: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
  stickerPackAdded: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
  stickerAdded: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
  stickerPackUpdated: (..._args: Array<any>) => ({ type: 'stickers/STUB' as const }),
};

export const reducer = (): StickersStateType => ({
  packs: {}, // Record<string, StickerPackDBType>
  recentStickers: [], // ReadonlyArray<StickerDBType>
  blessedPacks: [], // ReadonlyArray<StickerPackDBType>
  installedPack: null,
});

export const getEmptyState = (): StickersStateType => ({
  packs: {}, // Record<string, StickerPackDBType>
  recentStickers: [], // ReadonlyArray<StickerDBType>
  blessedPacks: [], // ReadonlyArray<StickerPackDBType>
  installedPack: null,
});

export const useStickersActions = () => actions;

export type StickersActionType = never;
