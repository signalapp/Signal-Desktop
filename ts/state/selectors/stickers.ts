import { join } from 'path';
import {
  compact,
  Dictionary,
  filter,
  map,
  orderBy,
  reject,
  sortBy,
  values,
} from 'lodash';
import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  RecentStickerType,
  StickerDBType,
  StickerPackDBType,
  StickerPackType,
  StickersStateType,
  StickerType,
} from '../ducks/stickers';
import { getStickersPath, getTempPath } from './user';

const getSticker = (
  packs: Dictionary<StickerPackDBType>,
  packId: string,
  stickerId: number,
  stickerPath: string,
  tempPath: string
): StickerType | undefined => {
  const pack = packs[packId];
  if (!pack) {
    return;
  }

  const sticker = pack.stickers[stickerId];
  if (!sticker) {
    return;
  }

  const isEphemeral = pack.status === 'ephemeral';

  return translateStickerFromDB(sticker, stickerPath, tempPath, isEphemeral);
};

const translateStickerFromDB = (
  sticker: StickerDBType,
  stickerPath: string,
  tempPath: string,
  isEphemeral: boolean
): StickerType => {
  const { id, packId, emoji, path } = sticker;
  const prefix = isEphemeral ? tempPath : stickerPath;

  return {
    id,
    packId,
    emoji,
    url: join(prefix, path),
  };
};

export const translatePackFromDB = (
  pack: StickerPackDBType,
  packs: Dictionary<StickerPackDBType>,
  blessedPacks: Dictionary<boolean>,
  stickersPath: string,
  tempPath: string
) => {
  const { id, stickers, status, coverStickerId } = pack;
  const isEphemeral = status === 'ephemeral';

  // Sometimes sticker packs have a cover which isn't included in their set of stickers.
  //   We don't want to show cover-only images when previewing or picking from a pack.
  const filteredStickers = reject(
    values(stickers),
    sticker => sticker.isCoverOnly
  );
  const translatedStickers = map(filteredStickers, sticker =>
    translateStickerFromDB(sticker, stickersPath, tempPath, isEphemeral)
  );

  return {
    ...pack,
    isBlessed: Boolean(blessedPacks[id]),
    cover: getSticker(packs, id, coverStickerId, stickersPath, tempPath),
    stickers: sortBy(translatedStickers, sticker => sticker.id),
  };
};

const filterAndTransformPacks = (
  packs: Dictionary<StickerPackDBType>,
  packFilter: (sticker: StickerPackDBType) => boolean,
  packSort: (sticker: StickerPackDBType) => any,
  blessedPacks: Dictionary<boolean>,
  stickersPath: string,
  tempPath: string
): Array<StickerPackType> => {
  const list = filter(packs, packFilter);
  const sorted = orderBy<StickerPackDBType>(list, packSort, ['desc']);

  return sorted.map(pack =>
    translatePackFromDB(pack, packs, blessedPacks, stickersPath, tempPath)
  );
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
  getStickersPath,
  getTempPath,
  (
    recents: Array<RecentStickerType>,
    packs: Dictionary<StickerPackDBType>,
    stickersPath: string,
    tempPath: string
  ) => {
    return compact(
      recents.map(({ packId, stickerId }) => {
        return getSticker(packs, packId, stickerId, stickersPath, tempPath);
      })
    );
  }
);

export const getInstalledStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  getStickersPath,
  getTempPath,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>,
    stickersPath: string,
    tempPath: string
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => pack.status === 'installed',
      pack => pack.installedAt,
      blessedPacks,
      stickersPath,
      tempPath
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
  getStickersPath,
  getTempPath,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>,
    stickersPath: string,
    tempPath: string
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack =>
        (pack.status === 'downloaded' || pack.status === 'pending') &&
        !blessedPacks[pack.id],
      pack => pack.createdAt,
      blessedPacks,
      stickersPath,
      tempPath
    );
  }
);

export const getBlessedStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  getStickersPath,
  getTempPath,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>,
    stickersPath: string,
    tempPath: string
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => blessedPacks[pack.id] && pack.status !== 'installed',
      pack => pack.createdAt,
      blessedPacks,
      stickersPath,
      tempPath
    );
  }
);

export const getKnownStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  getStickersPath,
  getTempPath,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>,
    stickersPath: string,
    tempPath: string
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => !blessedPacks[pack.id] && pack.status === 'known',
      pack => pack.createdAt,
      blessedPacks,
      stickersPath,
      tempPath
    );
  }
);
