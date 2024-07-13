// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Dictionary } from 'lodash';
import { compact, filter, map, orderBy, reject, sortBy, values } from 'lodash';
import { createSelector } from 'reselect';

import type { RecentStickerType } from '../../types/Stickers';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from '../../util/getLocalAttachmentUrl';
import type {
  StickerType as StickerDBType,
  StickerPackType as StickerPackDBType,
} from '../../sql/Interface';
import type { StateType } from '../reducer';
import type {
  StickersStateType,
  StickerPackType,
  StickerType,
} from '../ducks/stickers';

const getSticker = (
  packs: Dictionary<StickerPackDBType>,
  packId: string,
  stickerId: number
): StickerType | undefined => {
  const pack = packs[packId];
  if (!pack) {
    return undefined;
  }

  const sticker = pack.stickers[stickerId];
  if (!sticker) {
    return undefined;
  }

  const isEphemeral = pack.status === 'ephemeral';

  return translateStickerFromDB(sticker, isEphemeral);
};

const translateStickerFromDB = (
  sticker: StickerDBType,
  isEphemeral: boolean
): StickerType => {
  const { id, packId, emoji } = sticker;

  return {
    id,
    packId,
    emoji,
    url: getLocalAttachmentUrl(sticker, {
      disposition: isEphemeral
        ? AttachmentDisposition.Temporary
        : AttachmentDisposition.Sticker,
    }),
  };
};

export const translatePackFromDB = (
  pack: StickerPackDBType,
  packs: Dictionary<StickerPackDBType>,
  blessedPacks: Dictionary<boolean>
): StickerPackType => {
  const { id, stickers, status, coverStickerId } = pack;
  const isEphemeral = status === 'ephemeral';

  // Sometimes sticker packs have a cover which isn't included in their set of stickers.
  //   We don't want to show cover-only images when previewing or picking from a pack.
  const filteredStickers = reject(
    values(stickers),
    sticker => sticker.isCoverOnly
  );
  const translatedStickers = map(filteredStickers, sticker =>
    translateStickerFromDB(sticker, isEphemeral)
  );

  return {
    ...pack,
    isBlessed: Boolean(blessedPacks[id]),
    cover: getSticker(packs, id, coverStickerId),
    stickers: sortBy(translatedStickers, sticker => sticker.id),
  };
};

const filterAndTransformPacks = (
  packs: Dictionary<StickerPackDBType>,
  packFilter: (sticker: StickerPackDBType) => boolean,
  packSort: (sticker: StickerPackDBType) => number | undefined,
  blessedPacks: Dictionary<boolean>
): Array<StickerPackType> => {
  const list = filter(packs, packFilter);
  const sorted = orderBy<StickerPackDBType>(list, packSort, ['desc']);

  return sorted.map(pack => translatePackFromDB(pack, packs, blessedPacks));
};

const getStickers = (state: StateType) => state.stickers;

export const getPacks = createSelector(
  getStickers,
  (stickers: StickersStateType) => stickers.packs
);

const getRecents = createSelector(
  getStickers,
  (stickers: StickersStateType) => stickers.recentStickers
);

export const getBlessedPacks = createSelector(
  getStickers,
  (stickers: StickersStateType) => stickers.blessedPacks
);

export const getRecentStickers = createSelector(
  getRecents,
  getPacks,
  (
    recents: ReadonlyArray<RecentStickerType>,
    packs: Dictionary<StickerPackDBType>
  ) => {
    return compact(
      recents.map(({ packId, stickerId }) => {
        return getSticker(packs, packId, stickerId);
      })
    );
  }
);

export const getInstalledStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => pack.status === 'installed',
      pack => pack.installedAt,
      blessedPacks
    );
  }
);

export const getRecentlyInstalledStickerPack = createSelector(
  getInstalledStickerPacks,
  getStickers,
  (packs, { installedPack: packId }) => {
    if (!packId) {
      return null;
    }

    return packs.find(({ id }) => id === packId) || null;
  }
);

export const getReceivedStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack =>
        (pack.status === 'downloaded' || pack.status === 'pending') &&
        !blessedPacks[pack.id],
      pack => pack.createdAt,
      blessedPacks
    );
  }
);

export const getBlessedStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => blessedPacks[pack.id] && pack.status !== 'installed',
      pack => pack.createdAt,
      blessedPacks
    );
  }
);

export const getKnownStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => !blessedPacks[pack.id] && pack.status === 'known',
      pack => pack.createdAt,
      blessedPacks
    );
  }
);
