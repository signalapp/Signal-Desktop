import { Dictionary, omit, reject } from 'lodash';
import {
  getRecentStickers,
  updateStickerLastUsed,
  updateStickerPackStatus,
} from '../../../js/modules/data';
import {
  downloadStickerPack as externalDownloadStickerPack,
  maybeDeletePack,
} from '../../../js/modules/stickers';
import { sendStickerPackSync } from '../../shims/textsecure';
import { trigger } from '../../shims/events';

import { NoopActionType } from './noop';

// State

export type StickerDBType = {
  readonly id: number;
  readonly packId: string;

  readonly emoji: string;
  readonly isCoverOnly: string;
  readonly lastUsed: number;
  readonly path: string;
};

export type StickerPackDBType = {
  readonly id: string;
  readonly key: string;

  readonly attemptedStatus: 'downloaded' | 'installed' | 'ephemeral';
  readonly author: string;
  readonly coverStickerId: number;
  readonly createdAt: number;
  readonly downloadAttempts: number;
  readonly installedAt: number | null;
  readonly lastUsed: number;
  readonly status:
    | 'known'
    | 'ephemeral'
    | 'downloaded'
    | 'installed'
    | 'pending'
    | 'error';
  readonly stickerCount: number;
  readonly stickers: Dictionary<StickerDBType>;
  readonly title: string;
};

export type RecentStickerType = {
  readonly stickerId: number;
  readonly packId: string;
};

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
  readonly emoji: string;
  readonly url: string;
};

export type StickerPackType = {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly author: string;
  readonly isBlessed: boolean;
  readonly cover?: StickerType;
  readonly lastUsed: number;
  readonly attemptedStatus?: 'downloaded' | 'installed' | 'ephemeral';
  readonly status:
    | 'known'
    | 'ephemeral'
    | 'downloaded'
    | 'installed'
    | 'pending'
    | 'error';
  readonly stickers: Array<StickerType>;
  readonly stickerCount: number;
};

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
  status: 'downloaded';
  installedAt: null;
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

function stickerPackAdded(payload: StickerPackDBType): StickerPackAddedAction {
  const { status, attemptedStatus } = payload;

  // We do this to trigger a toast, which is still done via Backbone
  if (status === 'error' && attemptedStatus === 'installed') {
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
  // tslint:disable-next-line:no-floating-promises
  externalDownloadStickerPack(packId, packKey, { finalStatus });

  return {
    type: 'NOOP',
    payload: null,
  };
}

function installStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync: boolean } | null = null
): InstallStickerPackAction {
  return {
    type: 'stickers/INSTALL_STICKER_PACK',
    payload: doInstallStickerPack(packId, packKey, options),
  };
}
async function doInstallStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync: boolean } | null
): Promise<InstallStickerPackPayloadType> {
  const { fromSync } = options || { fromSync: false };

  const status = 'installed';
  const timestamp = Date.now();
  await updateStickerPackStatus(packId, status, { timestamp });

  if (!fromSync) {
    // Kick this off, but don't wait for it
    sendStickerPackSync(packId, packKey, true);
  }

  const recentStickers = await getRecentStickers();

  return {
    packId,
    installedAt: timestamp,
    status,
    recentStickers: recentStickers.map(item => ({
      packId: item.packId,
      stickerId: item.id,
    })),
  };
}
function uninstallStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync: boolean } | null = null
): UninstallStickerPackAction {
  return {
    type: 'stickers/UNINSTALL_STICKER_PACK',
    payload: doUninstallStickerPack(packId, packKey, options),
  };
}
async function doUninstallStickerPack(
  packId: string,
  packKey: string,
  options: { fromSync: boolean } | null
): Promise<UninstallStickerPackPayloadType> {
  const { fromSync } = options || { fromSync: false };

  const status = 'downloaded';
  await updateStickerPackStatus(packId, status);

  // If there are no more references, it should be removed
  await maybeDeletePack(packId);

  if (!fromSync) {
    // Kick this off, but don't wait for it
    sendStickerPackSync(packId, packKey, false);
  }

  const recentStickers = await getRecentStickers();

  return {
    packId,
    status,
    installedAt: null,
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
  patch: Partial<StickerPackDBType>
): StickerPackUpdatedAction {
  const { status, attemptedStatus } = patch;

  // We do this to trigger a toast, which is still done via Backbone
  if (status === 'error' && attemptedStatus === 'installed') {
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
  time = Date.now()
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

function getEmptyState(): StickersStateType {
  return {
    installedPack: null,
    packs: {},
    recentStickers: [],
    blessedPacks: {},
  };
}

// tslint:disable-next-line max-func-body-length
export function reducer(
  state: StickersStateType = getEmptyState(),
  action: StickersActionType
): StickersStateType {
  if (action.type === 'stickers/STICKER_PACK_ADDED') {
    const { payload } = action;
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
    const { installedAt, packId, status, recentStickers } = payload;
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

    return {
      ...state,
      installedPack: packId,
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
