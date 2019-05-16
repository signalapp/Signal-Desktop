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
import { getStickersPath } from './user';

const getSticker = (
  packs: Dictionary<StickerPackDBType>,
  packId: string,
  stickerId: number,
  stickerPath: string
): StickerType | undefined => {
  const pack = packs[packId];
  if (!pack) {
    return;
  }

  const sticker = pack.stickers[stickerId];
  if (!sticker) {
    return;
  }

  return translateStickerFromDB(sticker, stickerPath);
};

const translateStickerFromDB = (
  sticker: StickerDBType,
  stickerPath: string
): StickerType => {
  const { id, packId, emoji, path } = sticker;

  return {
    id,
    packId,
    emoji,
    url: join(stickerPath, path),
  };
};

export const translatePackFromDB = (
  pack: StickerPackDBType,
  packs: Dictionary<StickerPackDBType>,
  blessedPacks: Dictionary<boolean>,
  stickersPath: string
) => {
  const { id, stickers, coverStickerId } = pack;

  // Sometimes sticker packs have a cover which isn't included in their set of stickers.
  //   We don't want to show cover-only images when previewing or picking from a pack.
  const filteredStickers = reject(
    values(stickers),
    sticker => sticker.isCoverOnly
  );
  const translatedStickers = map(filteredStickers, sticker =>
    translateStickerFromDB(sticker, stickersPath)
  );

  return {
    ...pack,
    isBlessed: Boolean(blessedPacks[id]),
    cover: getSticker(packs, id, coverStickerId, stickersPath),
    stickers: sortBy(translatedStickers, sticker => sticker.id),
  };
};

const filterAndTransformPacks = (
  packs: Dictionary<StickerPackDBType>,
  packFilter: (sticker: StickerPackDBType) => boolean,
  packSort: (sticker: StickerPackDBType) => any,
  blessedPacks: Dictionary<boolean>,
  stickersPath: string
): Array<StickerPackType> => {
  const list = filter(packs, packFilter);
  const sorted = orderBy<StickerPackDBType>(list, packSort, ['desc']);

  const ready = sorted.map(pack =>
    translatePackFromDB(pack, packs, blessedPacks, stickersPath)
  );

  // We're explicitly forcing pack.cover to be truthy here, but TypeScript doesn't
  //   understand that.
  return ready.filter(pack => Boolean(pack.cover)) as Array<StickerPackType>;
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
  (
    recents: Array<RecentStickerType>,
    packs: Dictionary<StickerPackDBType>,
    stickersPath: string
  ) => {
    return compact(
      recents.map(({ packId, stickerId }) => {
        return getSticker(packs, packId, stickerId, stickersPath);
      })
    );
  }
);

export const getInstalledStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  getStickersPath,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>,
    stickersPath: string
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => pack.status === 'installed',
      pack => pack.installedAt,
      blessedPacks,
      stickersPath
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
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>,
    stickersPath: string
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack =>
        (pack.status === 'advertised' || pack.status === 'pending') &&
        !blessedPacks[pack.id],
      pack => pack.createdAt,
      blessedPacks,
      stickersPath
    );
  }
);

export const getBlessedStickerPacks = createSelector(
  getPacks,
  getBlessedPacks,
  getStickersPath,
  (
    packs: Dictionary<StickerPackDBType>,
    blessedPacks: Dictionary<boolean>,
    stickersPath: string
  ): Array<StickerPackType> => {
    return filterAndTransformPacks(
      packs,
      pack => blessedPacks[pack.id] && pack.status !== 'installed',
      pack => pack.createdAt,
      blessedPacks,
      stickersPath
    );
  }
);
