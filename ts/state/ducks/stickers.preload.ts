// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash, { type Dictionary } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import type {
  StickerPackStatusType,
  StickerType as StickerDBType,
  StickerPackType as StickerPackDBType,
} from '../../sql/Interface.std.ts';
import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import type {
  ActionSourceType,
  RecentStickerType,
  StickerManagerTabType,
} from '../../types/Stickers.preload.ts';
import {
  downloadStickerPack as externalDownloadStickerPack,
  maybeDeletePack,
} from '../../types/Stickers.preload.ts';
import { drop } from '../../util/drop.std.ts';
import { runStorageServiceUploadJob } from '../../services/storage.preload.ts';
import { sendStickerPackSync } from '../../shims/textsecure.preload.ts';
import { trigger } from '../../shims/events.dom.ts';
import { ERASE_STORAGE_SERVICE } from './user.preload.ts';
import type { EraseStorageServiceStateAction } from './user.preload.ts';

import { noopAction, type NoopActionType } from './noop.std.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import type { Emoji } from '../../axo/emoji.std.ts';
import type { StateType as RootStateType } from '../reducer.preload.ts';
import { getPacks } from '../selectors/stickers.std.ts';

const { omit, reject } = lodash;

const { getRecentStickers } = DataReader;
const { updateStickerLastUsed } = DataWriter;

// State

export type StickersStateType = ReadonlyDeep<{
  installedPack: string | null;
  packs: Dictionary<StickerPackDBType>;
  recentStickers: Array<RecentStickerType>;
  blessedPacks: Dictionary<boolean>;
  stickerManagerTab: StickerManagerTabType;
}>;

// These are for the React components

export type StickerType = ReadonlyDeep<{
  id: number;
  packId: string;
  emoji?: Emoji.Variant;
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
  position: number | undefined;
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

type SetStickerManagerTabAction = ReadonlyDeep<{
  type: 'stickers/SET_STICKER_MANAGER_TAB';
  payload: StickerManagerTabType;
}>;
type StickerPacksPositionsUpdatedAction = ReadonlyDeep<{
  type: 'stickers/STICKER_PACKS_POSITIONS_UPDATED';
  payload: ReadonlyArray<{ id: string; position: number }>;
}>;

export type StickersActionType = ReadonlyDeep<
  | ClearInstalledStickerPackAction
  | InstallStickerPackFulfilledAction
  | NoopActionType
  | SetStickerManagerTabAction
  | StickerAddedAction
  | StickerPackAddedAction
  | StickerPackRemovedAction
  | StickerPackUpdatedAction
  | UninstallStickerPackFulfilledAction
  | UseStickerFulfilledAction
  | StickerPacksPositionsUpdatedAction
>;

// Action Creators

export const actions = {
  clearInstalledStickerPack,
  downloadStickerPack,
  installStickerPack,
  removeStickerPack,
  setStickerManagerTab,
  stickerAdded,
  stickerPackAdded,
  stickerPackUpdated,
  uninstallStickerPack,
  useSticker,
  updateStickerPacksPositions,
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

  // We do this to trigger a toast, which is still done via Whisper.events
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

  return noopAction('downloadStickerPack');
}

function installStickerPack(
  packId: string,
  packKey: string,
  {
    actionSource,
    position,
  }: { actionSource: ActionSourceType; position?: number }
): InstallStickerPackAction {
  return {
    type: 'stickers/INSTALL_STICKER_PACK',
    payload: doInstallStickerPack(packId, packKey, { actionSource, position }),
  };
}
async function doInstallStickerPack(
  packId: string,
  packKey: string,
  {
    actionSource,
    position,
  }: { actionSource: ActionSourceType; position?: number }
): Promise<InstallStickerPackPayloadType> {
  const timestamp = Date.now();
  const { wasPreviouslyUninstalled, position: newPosition } =
    await DataWriter.installStickerPack(packId, timestamp, position);

  if (actionSource === 'ui') {
    // Kick this off, but don't wait for it
    drop(sendStickerPackSync(packId, packKey, true));
  }

  if (
    // Don't cause storageService loop
    actionSource !== 'storageService' &&
    // Stickers downloaded on startup should already be synced
    actionSource !== 'startup' &&
    wasPreviouslyUninstalled
  ) {
    runStorageServiceUploadJob({ reason: 'doInstallServicePack' });
  }

  const recentStickers = await getRecentStickers();

  return {
    packId,
    actionSource,
    status: 'installed',
    installedAt: timestamp,
    position: newPosition,
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
    runStorageServiceUploadJob({ reason: 'doUninstallStickerPack' });
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

  // We do this to trigger a toast, which is still done via Whisper.events
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

function setStickerManagerTab(
  tab: StickerManagerTabType
): SetStickerManagerTabAction {
  return {
    type: 'stickers/SET_STICKER_MANAGER_TAB',
    payload: tab,
  };
}

function updateStickerPacksPositions(
  orderedPackIds: ReadonlyArray<string>
): ThunkAction<
  void,
  RootStateType,
  unknown,
  StickerPacksPositionsUpdatedAction
> {
  return async (dispatch, getState) => {
    const packs = getPacks(getState());
    const nextPackPositions = new Array<{ id: string; position: number }>();
    orderedPackIds.forEach((id, index) => {
      const nextPosition = index + 1;
      if (packs[id]?.position !== nextPosition) {
        nextPackPositions.push({ id, position: nextPosition });
      }
    });
    await DataWriter.updateStickerPacksPositions(nextPackPositions);

    runStorageServiceUploadJob({ reason: 'updateStickerPacksPositions' });
    dispatch({
      type: 'stickers/STICKER_PACKS_POSITIONS_UPDATED',
      payload: nextPackPositions,
    });
  };
}

// Reducer

export function getEmptyState(): StickersStateType {
  return {
    installedPack: null,
    packs: {},
    recentStickers: [],
    blessedPacks: {},
    stickerManagerTab: 'all',
  };
}

export function reducer(
  state: Readonly<StickersStateType> = getEmptyState(),
  action: Readonly<StickersActionType | EraseStorageServiceStateAction>
): StickersStateType {
  if (action.type === 'stickers/STICKER_PACK_ADDED') {
    const { payload } = action;

    // When going from an ephemeral (previewed) pack to installed state,
    // copy over ephemeral pack props in memory
    const oldPack = state.packs[payload.id];
    const isInstallingPack =
      oldPack !== undefined &&
      payload.attemptedStatus === 'installed' &&
      payload.status === 'pending';
    let newPack: StickerPackDBType;
    if (isInstallingPack) {
      newPack = {
        ...payload,
        stickerCount:
          oldPack.stickerCount !== 0
            ? oldPack.stickerCount
            : payload.stickerCount,
        title: payload.title === '' ? oldPack.title : payload.title,
        author: payload.author === '' ? oldPack.author : payload.author,
        // TODO: Ephemeral stickers are stored at a different path then downloaded stickers
        // so we can't reuse them
        stickers: payload.stickers ?? {},
      };
    } else {
      newPack = {
        ...payload,
        stickers: payload.stickers ?? {},
      };
    }

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
    strictAssert(packToUpdate, 'Missing packToUpdate');

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
    strictAssert(packToUpdate, 'Missing packToUpdate');

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

    const position = 'position' in payload ? payload.position : undefined;

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
          ...existingPack,
          status,
          installedAt,
          position: position ?? existingPack.position,
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
    strictAssert(pack, 'Missing pack');
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

  if (action.type === 'stickers/SET_STICKER_MANAGER_TAB') {
    const { payload: stickerManagerTab } = action;

    return {
      ...state,
      stickerManagerTab,
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

  if (action.type === 'stickers/STICKER_PACKS_POSITIONS_UPDATED') {
    const { packs } = state;

    const { payload } = action;
    const packPositionMap = new Map<string, number>();
    for (const packIdPosition of payload) {
      const { id, position } = packIdPosition;
      packPositionMap.set(id, position);
    }

    const entries = Object.entries(packs).map(([id, pack]) => {
      const position = packPositionMap.get(id);
      return [id, position ? { ...pack, position } : pack];
    });
    return {
      ...state,
      packs: Object.fromEntries(entries),
    };
  }

  return state;
}
