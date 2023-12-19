// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';

import type { ArtImageData } from '../types.d';
import type { ArtPath, StateArtData, StateToastData } from '../slices/art';
import type { RootState } from '../store';
import { ArtType, MIN_STICKERS, MAX_STICKERS } from '../constants';
import { assert } from '../util/assert';

export const useTitle = (): string =>
  useSelector(({ art }: RootState) => art.title);

export const useAuthor = (): string =>
  useSelector(({ art }: RootState) => art.author);

export const useCover = (): ArtImageData | undefined =>
  useSelector(({ art }: RootState) => art.cover);

export const useArtType = (): ArtType =>
  useSelector(({ art }: RootState) => art.artType);

export const useArtOrder = (): ReadonlyArray<ArtPath> =>
  useSelector(({ art }: RootState) => art.order);

export const useArtData = (src: ArtPath): StateArtData | undefined =>
  useSelector(({ art }: RootState) => art.data[src]);

export const useArtReady = (): boolean =>
  useSelector(({ art }: RootState) => {
    assert(art.artType === ArtType.Sticker, 'Unexpected art type');
    const min = MIN_STICKERS;
    const max = MAX_STICKERS;

    return (
      art.order.length >= min &&
      art.order.length <= max &&
      Object.values(art.data).every(({ imageData }) => Boolean(imageData))
    );
  });

export const useEmojisReady = (): boolean =>
  useSelector(({ art }: RootState) =>
    Object.values(art.data).every(({ emoji }) => {
      if (!emoji?.emoji) {
        return false;
      }

      assert(art.artType === ArtType.Sticker, 'Unexpected art type');
      return true;
    })
  );

export const useAllDataValid = (): boolean => {
  const artReady = useArtReady();
  const emojisReady = useEmojisReady();
  const cover = useCover();
  const title = useTitle();
  const author = useAuthor();

  return !!(artReady && emojisReady && cover && title && author);
};

const selectUrl = createSelector(
  ({ art }: RootState) => art.artType,
  ({ art }: RootState) => art.packId,
  ({ art }: RootState) => art.packKey,
  (artType, id, key) => {
    assert(artType === ArtType.Sticker, 'Unexpected art type');
    return `https://signal.art/addstickers/#pack_id=${id}&pack_key=${key}`;
  }
);

export const usePackUrl = (): string => useSelector(selectUrl);

export const useToasts = (): ReadonlyArray<StateToastData> =>
  useSelector(({ art }: RootState) => art.toasts);

export const useAddMoreCount = (): number =>
  useSelector(({ art }: RootState) => {
    assert(art.artType === ArtType.Sticker, 'Unexpected art type');
    const min = MIN_STICKERS;

    return Math.min(Math.max(min - art.order.length, 0), min);
  });

const selectOrderedData = createSelector(
  ({ art }: RootState) => art.order,
  ({ art }: RootState) => art.data,
  (order, data) =>
    order.map(id => data[id]).filter((x): x is StateArtData => x !== undefined)
);

export const useSelectOrderedData = (): ReadonlyArray<StateArtData> =>
  useSelector(selectOrderedData);

const selectOrderedImagePaths = createSelector(
  selectOrderedData,
  (data: ReadonlyArray<StateArtData>): ReadonlyArray<ArtPath> =>
    data
      .map(({ imageData }) => imageData?.src)
      .filter((src): src is ArtPath => src !== undefined)
);

export const useOrderedImagePaths = (): ReadonlyArray<ArtPath> =>
  useSelector(selectOrderedImagePaths);
