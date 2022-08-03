// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Dictionary } from 'lodash';
import { omit, reject } from 'lodash';
import type {
  StickerPackStatusType,
  StickerType as StickerDBType,
  StickerPackType as StickerPackDBType,
} from '../../sql/Interface';
import dataInterface from '../../sql/Client';
import type { RecentStickerType } from '../../types/Stickers';
import {
  downloadStickerPack as externalDownloadStickerPack,
  maybeDeletePack,
} from '../../types/Stickers';
import { storageServiceUploadJob } from '../../services/storage';
import { sendStickerPackSync } from '../../shims/textsecure';
import { trigger } from '../../shims/events';

import type { NoopActionType } from './noop';

const { getRecentStickers, updateStickerLastUsed } = dataInterface;

// State

export type StickersStateType = {
  readonly installedPack: string | null;
  readonly packs: Dictionary<StickerPackDBType>;
  readonly recentStickers: Array<RecentStickerType>;
  readonly blessedPacks: Dictionary<boolean>;
};

// These are for the React components

export type StickerType = {
  readonly id: number;
  readonly packId: string;
  readonly emoji?: string;
  readonly url: string;
};

export type StickerPackType = Readonly<{
  id: string;
  key: string;
  title: string;
  author: string;
  isBlessed: boolean;
  cover?: StickerType;
  lastUsed?: number;
  attemptedStatus?: 'downloaded' | 'installed' | 'ephemeral';
  status: StickerPackStatusType;
  stickers: Array<StickerType>;
  stickerCount: number;
}>;

// Actions

type StickerPackAddedAction = {
  type: 'stickers/STICKER_PACK_ADDED';
  payload: StickerPackDBType;
};

type StickerAddedAction = {
  type: 'stickers/STICKER_ADDED';
  payload: StickerDBType;
};

type InstallStickerPackPayloadType = {
  packId: string;
  fromSync: boolean;
  status: 'installed';
  installedAt: number;
  recentStickers: Array<RecentStickerType>;
};
type InstallStickerPackAction = {
  type: 'stickers/INSTALL_STICKER_PACK';
  payload: Promise<InstallStickerPackPayloadType>;
};
type InstallStickerPackFulfilledAction = {
  type: 'stickers/INSTALL_STICKER_PACK_FULFILLED';
  payload: InstallStickerPackPayloadType;
};
type ClearInstalledStickerPackAction = {
  type: 'stickers/CLEAR_INSTALLED_STICKER_PACK';
};

type UninstallStickerPackPayloadType = {
  packId: string;
  fromSync: boolean;
  status: 'downloaded';
  installedAt?: undefined;
  recentStickers: Array<RecentStickerType>;
};
type UninstallStickerPackAction = {
  type: 'stickers/UNINSTALL_STICKER_PACK';
  payload: Promise<UninstallStickerPackPayloadType>;
};
type UninstallStickerPackFulfilledAction = {
  type: 'stickers/UNINSTALL_STICKER_PACK_FULFILLED';
  payload: UninstallStickerPackPayloadType;
};

type StickerPackUpdatedAction = {
  type: 'stickers/STICKER_PACK_UPDATED';
  payload: { packId: string; patch: Partial<StickerPackDBType> };
};

type StickerPackRemovedAction = {
  type: 'stickers/REMOVE_STICKER_PACK';
  payload: string;
};

type UseStickerPayloadType = {
  packId: string;
  stickerId: number;
  time: number;
};
type UseStickerAction = {
  type: 'stickers/USE_STICKER';
  payload: Promise<UseStickerPayloadType>;
};
type UseStickerFulfilledAction = {
  type: 'stickers/USE_STICKER_FULFILLED';
  payload: UseStickerPayloadType;
};

export type StickersActionType =
  | ClearInstalledStickerPackAction
  | StickerAddedAction
  | StickerPackAddedAction
  | InstallStickerPackFulfilledAction
  | UninstallStickerPackFulfilledAction
  | StickerPackUpdatedAction
  | StickerPackRemovedAction
  | UseStickerFulfilledAction
  | NoopActionType;

// Action Creators

export const actions = {
  downloadStickerPack,
  clearInstalledStickerPack,
  removeStickerPack,
  stickerAdded,
  stickerPackAdded,
  installStickerPack,
  uninstallStickerPack,
  stickerPackUpdated,
  useSticker,
};

function removeStickerPack(id: string): StickerPackRemovedAction {
  return {
    type: 'stickers/REMOVE_STICKER_PACK',
    payload: id,
  };
}

function stickerAdded(payload: StickerDBType): StickerAddedAction {
  return {
    type: 'stickers/STICKER_ADDED',
    payload,
  };
}

function stickerPackAdded(
  payload: StickerPackDBType,
  options?: { suppressError?: boolean }
): StickerPackAddedAction {
  const { status, attemptedStatus } = payload;

  // We do this to trigger a toast, which is still done via Backbone
  if (
    status === 'error' &&
    attemptedStatus === 'installed' &&
    !options?.suppressError
  ) {
    trigger('pack-install-failed');
  }

  return {
    type: 'stickers/STICKER_PACK_ADDED',
    payload,
  };
}

function downloadStickerPack(
  packId: string,
  packKey: string,
  options?: { finalStatus?: 'installed' | 'downloaded' }
): NoopActionType {
  const { finalStatus } = options || { finalStatus: undefined };

  // We're just kicking this off, since it will generate more redux events
  externalDownloadStickerPack(packId, packKey, { finalStatus });

  return {
    type: 'NOOP',
    payload: null,
  };
}

function installStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync?: boolean; fromStorageService?: boolean } = {}
): InstallStickerPackAction {
  return {
    type: 'stickers/INSTALL_STICKER_PACK',
    payload: doInstallStickerPack(packId, packKey, options),
  };
}
async function doInstallStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync?: boolean; fromStorageService?: boolean } = {}
): Promise<InstallStickerPackPayloadType> {
  const { fromSync = false, fromStorageService = false } = options;

  const timestamp = Date.now();
  await dataInterface.installStickerPack(packId, timestamp);

  if (!fromSync && !fromStorageService) {
    // Kick this off, but don't wait for it
    sendStickerPackSync(packId, packKey, true);
  }

  if (!fromStorageService) {
    storageServiceUploadJob();
  }

  const recentStickers = await getRecentStickers();

  return {
    packId,
    fromSync,
    status: 'installed',
    installedAt: timestamp,
    recentStickers: recentStickers.map(item => ({
      packId: item.packId,
      stickerId: item.id,
    })),
  };
}
function uninstallStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync?: boolean; fromStorageService?: boolean } = {}
): UninstallStickerPackAction {
  return {
    type: 'stickers/UNINSTALL_STICKER_PACK',
    payload: doUninstallStickerPack(packId, packKey, options),
  };
}
async function doUninstallStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync?: boolean; fromStorageService?: boolean } = {}
): Promise<UninstallStickerPackPayloadType> {
  const { fromSync = false, fromStorageService = false } = options;

  const timestamp = Date.now();
  await dataInterface.uninstallStickerPack(packId, timestamp);

  // If there are no more references, it should be removed
  await maybeDeletePack(packId);

  if (!fromSync && !fromStorageService) {
    // Kick this off, but don't wait for it
    sendStickerPackSync(packId, packKey, false);
  }

  if (!fromStorageService) {
    storageServiceUploadJob();
  }

  const recentStickers = await getRecentStickers();

  return {
    packId,
    fromSync,
    status: 'downloaded',
    installedAt: undefined,
    recentStickers: recentStickers.map(item => ({
      packId: item.packId,
      stickerId: item.id,
    })),
  };
}
function clearInstalledStickerPack(): ClearInstalledStickerPackAction {
  return { type: 'stickers/CLEAR_INSTALLED_STICKER_PACK' };
}

function stickerPackUpdated(
  packId: string,
  patch: Partial<StickerPackDBType>,
  options?: { suppressError?: boolean }
): StickerPackUpdatedAction {
  const { status, attemptedStatus } = patch;

  // We do this to trigger a toast, which is still done via Backbone
  if (
    status === 'error' &&
    attemptedStatus === 'installed' &&
    !options?.suppressError
  ) {
    trigger('pack-install-failed');
  }

  return {
    type: 'stickers/STICKER_PACK_UPDATED',
    payload: {
      packId,
      patch,
    },
  };
}

function useSticker(
  packId: string,
  stickerId: number,
  time?: number
): UseStickerAction {
  return {
    type: 'stickers/USE_STICKER',
    payload: doUseSticker(packId, stickerId, time),
  };
}
async function doUseSticker(
  packId: string,
  stickerId: number,
  time = Date.now()
): Promise<UseStickerPayloadType> {
  await updateStickerLastUsed(packId, stickerId, time);

  return {
    packId,
    stickerId,
    time,
  };
}

// Reducer

export function getEmptyState(): StickersStateType {
  return {
    installedPack: null,
    packs: {},
    recentStickers: [],
    blessedPacks: {},
  };
}

export function reducer(
  state: Readonly<StickersStateType> = getEmptyState(),
  action: Readonly<StickersActionType>
): StickersStateType {
  if (action.type === 'stickers/STICKER_PACK_ADDED') {
    // ts complains due to `stickers: {}` being overridden by the payload
    // but without full confidence that that's the case, `any` and ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { payload } = action as any;
    const newPack = {
      stickers: {},
      ...payload,
    };

    return {
      ...state,
      packs: {
        ...state.packs,
        [payload.id]: newPack,
      },
    };
  }

  if (action.type === 'stickers/STICKER_ADDED') {
    const { payload } = action;
    const packToUpdate = state.packs[payload.packId];

    return {
      ...state,
      packs: {
        ...state.packs,
        [packToUpdate.id]: {
          ...packToUpdate,
          stickers: {
            ...packToUpdate.stickers,
            [payload.id]: payload,
          },
        },
      },
    };
  }

  if (action.type === 'stickers/STICKER_PACK_UPDATED') {
    const { payload } = action;
    const packToUpdate = state.packs[payload.packId];

    return {
      ...state,
      packs: {
        ...state.packs,
        [packToUpdate.id]: {
          ...packToUpdate,
          ...payload.patch,
        },
      },
    };
  }

  if (
    action.type === 'stickers/INSTALL_STICKER_PACK_FULFILLED' ||
    action.type === 'stickers/UNINSTALL_STICKER_PACK_FULFILLED'
  ) {
    const { payload } = action;
    const { fromSync, installedAt, packId, status, recentStickers } = payload;
    const { packs } = state;
    const existingPack = packs[packId];

    // A pack might be deleted as part of the uninstall process
    if (!existingPack) {
      return {
        ...state,
        installedPack:
          state.installedPack === packId ? null : state.installedPack,
        recentStickers,
      };
    }

    const isBlessed = state.blessedPacks[packId];
    const installedPack = !fromSync && !isBlessed ? packId : null;

    return {
      ...state,
      installedPack,
      packs: {
        ...packs,
        [packId]: {
          ...packs[packId],
          status,
          installedAt,
        },
      },
      recentStickers,
    };
  }

  if (action.type === 'stickers/CLEAR_INSTALLED_STICKER_PACK') {
    return {
      ...state,
      installedPack: null,
    };
  }

  if (action.type === 'stickers/REMOVE_STICKER_PACK') {
    const { payload } = action;

    return {
      ...state,
      packs: omit(state.packs, payload),
    };
  }

  if (action.type === 'stickers/USE_STICKER_FULFILLED') {
    const { payload } = action;
    const { packId, stickerId, time } = payload;
    const { recentStickers, packs } = state;

    const filteredRecents = reject(
      recentStickers,
      item => item.packId === packId && item.stickerId === stickerId
    );
    const pack = packs[packId];
    const sticker = pack.stickers[stickerId];

    return {
      ...state,
      recentStickers: [payload, ...filteredRecents],
      packs: {
        ...state.packs,
        [packId]: {
          ...pack,
          lastUsed: time,
          stickers: {
            ...pack.stickers,
            [stickerId]: {
              ...sticker,
              lastUsed: time,
            },
          },
        },
      },
    };
  }

  return state;
}
