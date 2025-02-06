// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Dictionary } from 'lodash';
import { omit, reject } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';
import type {
  StickerPackStatusType,
  StickerType as StickerDBType,
  StickerPackType as StickerPackDBType,
} from '../../sql/Interface';
import { DataReader, DataWriter } from '../../sql/Client';
import type { ActionSourceType, RecentStickerType } from '../../types/Stickers';
import {
  downloadStickerPack as externalDownloadStickerPack,
  maybeDeletePack,
} from '../../types/Stickers';
import { drop } from '../../util/drop';
import { storageServiceUploadJob } from '../../services/storage';
import { sendStickerPackSync } from '../../shims/textsecure';
import { trigger } from '../../shims/events';
import { ERASE_STORAGE_SERVICE } from './user';
import type { EraseStorageServiceStateAction } from './user';

import type { NoopActionType } from './noop';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

const { getRecentStickers } = DataReader;
const { updateStickerLastUsed } = DataWriter;

// State

export type StickersStateType = ReadonlyDeep<{
  installedPack: string | null;
  packs: Dictionary<StickerPackDBType>;
  recentStickers: Array<RecentStickerType>;
  blessedPacks: Dictionary<boolean>;
}>;

// These are for the React components

export type StickerType = ReadonlyDeep<{
  id: number;
  packId: string;
  emoji?: string;
  url: string;
}>;

export type StickerPackType = ReadonlyDeep<{
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

type StickerPackAddedAction = ReadonlyDeep<{
  type: 'stickers/STICKER_PACK_ADDED';
  payload: StickerPackDBType;
}>;

type StickerAddedAction = ReadonlyDeep<{
  type: 'stickers/STICKER_ADDED';
  payload: StickerDBType;
}>;

type InstallStickerPackPayloadType = ReadonlyDeep<{
  packId: string;
  actionSource: ActionSourceType;
  status: 'installed';
  installedAt: number;
  recentStickers: Array<RecentStickerType>;
}>;
type InstallStickerPackAction = ReadonlyDeep<{
  type: 'stickers/INSTALL_STICKER_PACK';
  payload: Promise<InstallStickerPackPayloadType>;
}>;
type InstallStickerPackFulfilledAction = ReadonlyDeep<{
  type: 'stickers/INSTALL_STICKER_PACK_FULFILLED';
  payload: InstallStickerPackPayloadType;
}>;
type ClearInstalledStickerPackAction = ReadonlyDeep<{
  type: 'stickers/CLEAR_INSTALLED_STICKER_PACK';
}>;

type UninstallStickerPackPayloadType = ReadonlyDeep<{
  packId: string;
  actionSource: ActionSourceType;
  status: 'downloaded';
  installedAt?: undefined;
  recentStickers: Array<RecentStickerType>;
}>;
type UninstallStickerPackAction = ReadonlyDeep<{
  type: 'stickers/UNINSTALL_STICKER_PACK';
  payload: Promise<UninstallStickerPackPayloadType>;
}>;
type UninstallStickerPackFulfilledAction = ReadonlyDeep<{
  type: 'stickers/UNINSTALL_STICKER_PACK_FULFILLED';
  payload: UninstallStickerPackPayloadType;
}>;

type StickerPackUpdatedAction = ReadonlyDeep<{
  type: 'stickers/STICKER_PACK_UPDATED';
  payload: { packId: string; patch: Partial<StickerPackDBType> };
}>;

type StickerPackRemovedAction = ReadonlyDeep<{
  type: 'stickers/REMOVE_STICKER_PACK';
  payload: string;
}>;

type UseStickerPayloadType = ReadonlyDeep<{
  packId: string;
  stickerId: number;
  time: number;
}>;
type UseStickerAction = ReadonlyDeep<{
  type: 'stickers/USE_STICKER';
  payload: Promise<UseStickerPayloadType>;
}>;
type UseStickerFulfilledAction = ReadonlyDeep<{
  type: 'stickers/USE_STICKER_FULFILLED';
  payload: UseStickerPayloadType;
}>;

export type StickersActionType = ReadonlyDeep<
  | ClearInstalledStickerPackAction
  | InstallStickerPackFulfilledAction
  | NoopActionType
  | StickerAddedAction
  | StickerPackAddedAction
  | StickerPackRemovedAction
  | StickerPackUpdatedAction
  | UninstallStickerPackFulfilledAction
  | UseStickerFulfilledAction
>;

// Action Creators

export const actions = {
  clearInstalledStickerPack,
  downloadStickerPack,
  installStickerPack,
  removeStickerPack,
  stickerAdded,
  stickerPackAdded,
  stickerPackUpdated,
  uninstallStickerPack,
  useSticker,
};

export const useStickersActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

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
  {
    finalStatus,
    actionSource,
  }: {
    finalStatus?: 'installed' | 'downloaded';
    actionSource: ActionSourceType;
  }
): NoopActionType {
  // We're just kicking this off, since it will generate more redux events
  drop(
    externalDownloadStickerPack(packId, packKey, {
      finalStatus,
      actionSource,
    })
  );

  return {
    type: 'NOOP',
    payload: null,
  };
}

function installStickerPack(
  packId: string,
  packKey: string,
  { actionSource }: { actionSource: ActionSourceType }
): InstallStickerPackAction {
  return {
    type: 'stickers/INSTALL_STICKER_PACK',
    payload: doInstallStickerPack(packId, packKey, { actionSource }),
  };
}
async function doInstallStickerPack(
  packId: string,
  packKey: string,
  { actionSource }: { actionSource: ActionSourceType }
): Promise<InstallStickerPackPayloadType> {
  const timestamp = Date.now();
  const changed = await DataWriter.installStickerPack(packId, timestamp);

  if (actionSource === 'ui') {
    // Kick this off, but don't wait for it
    drop(sendStickerPackSync(packId, packKey, true));
  }

  if (
    // Don't cause storageService loop
    actionSource !== 'storageService' &&
    // Stickers downloaded on startup should already be synced
    actionSource !== 'startup' &&
    changed
  ) {
    storageServiceUploadJob({ reason: 'doInstallServicePack' });
  }

  const recentStickers = await getRecentStickers();

  return {
    packId,
    actionSource,
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
  {
    actionSource,
    uninstalledAt,
  }: { actionSource: ActionSourceType; uninstalledAt?: number }
): UninstallStickerPackAction {
  return {
    type: 'stickers/UNINSTALL_STICKER_PACK',
    payload: doUninstallStickerPack(packId, packKey, {
      actionSource,
      uninstalledAt,
    }),
  };
}
async function doUninstallStickerPack(
  packId: string,
  packKey: string,
  {
    actionSource,
    uninstalledAt = Date.now(),
  }: { actionSource: ActionSourceType; uninstalledAt?: number }
): Promise<UninstallStickerPackPayloadType> {
  const changed = await DataWriter.uninstallStickerPack(packId, uninstalledAt);

  // If there are no more references, it should be removed
  await maybeDeletePack(packId);

  if (actionSource === 'ui') {
    // Kick this off, but don't wait for it
    drop(sendStickerPackSync(packId, packKey, false));
  }

  if (
    // Don't cause storageService loop
    actionSource !== 'storageService' &&
    // Stickers downloaded on startup should already be synced
    actionSource !== 'startup' &&
    changed
  ) {
    storageServiceUploadJob({ reason: 'doUninstallStickerPack' });
  }

  const recentStickers = await getRecentStickers();

  return {
    packId,
    actionSource,
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
  action: Readonly<StickersActionType | EraseStorageServiceStateAction>
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
    const { actionSource, installedAt, packId, status, recentStickers } =
      payload;
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
    const installedPack = actionSource === 'ui' && !isBlessed ? packId : null;

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

  if (action.type === ERASE_STORAGE_SERVICE) {
    const { packs } = state;

    const entries = Object.entries(packs).map(([id, pack]) => {
      return [
        id,
        omit(pack, [
          'storageID',
          'storageVersion',
          'storageUnknownFields',
          'storageNeedsSync',
        ]),
      ];
    });

    return {
      ...state,
      packs: Object.fromEntries(entries),
    };
  }

  return state;
}
