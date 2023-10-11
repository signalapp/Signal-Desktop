// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sample } from 'lodash';
import type { StickerPackType, StickerType } from '../../state/ducks/stickers';

export const sticker1: StickerType = {
  id: 1,
  url: '/fixtures/kitten-1-64-64.jpg',
  packId: 'foo',
  emoji: '',
};

export const sticker2: StickerType = {
  id: 2,
  url: '/fixtures/kitten-2-64-64.jpg',
  packId: 'bar',
  emoji: '',
};

export const sticker3: StickerType = {
  id: 3,
  url: '/fixtures/kitten-3-64-64.jpg',
  packId: 'baz',
  emoji: '',
};

export const abeSticker: StickerType = {
  id: 4,
  url: '/fixtures/512x515-thumbs-up-lincoln.webp',
  packId: 'abe',
  emoji: '',
};

export const wideSticker: StickerType = {
  id: 5,
  url: '/fixtures/1000x50-green.jpeg',
  packId: 'wide',
  emoji: '',
};

export const tallSticker: StickerType = {
  id: 6,
  url: '/fixtures/50x1000-teal.jpeg',
  packId: 'tall',
  emoji: '',
};

const choosableStickers = [sticker1, sticker2, sticker3, abeSticker];

export const createPack = (
  props: Partial<StickerPackType>,
  sticker?: StickerType
): StickerPackType => ({
  id: '',
  title: props.id ? `${props.id} title` : 'title',
  key: '',
  author: '',
  isBlessed: false,
  lastUsed: 0,
  status: 'known',
  cover: sticker,
  stickerCount: 101,
  stickers: sticker
    ? Array(101)
        .fill(0)
        .map((_, id) => ({ ...sticker, id }))
    : [],
  ...props,
});

export const packs = [
  createPack({ id: 'tall' }, tallSticker),
  createPack({ id: 'wide' }, wideSticker),
  ...Array(20)
    .fill(0)
    .map((_, n) =>
      createPack({ id: `pack-${n}` }, sample(choosableStickers) as StickerType)
    ),
];

export const recentStickers = [
  abeSticker,
  sticker1,
  sticker2,
  sticker3,
  tallSticker,
  wideSticker,
  { ...sticker2, id: 9999 },
];
