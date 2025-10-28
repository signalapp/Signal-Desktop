// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  StickerPackType,
  StickerType,
} from '../state/ducks/stickers.preload.js';

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

export const Stickers: Record<string, StickerType> = {
  kitten1: {
    id: 1,
    url: '/fixtures/kitten-1-64-64.jpg',
    packId: 'kitten1',
    emoji: '',
  },

  kitten2: {
    id: 2,
    url: '/fixtures/kitten-2-64-64.jpg',
    packId: 'kitten2',
    emoji: '',
  },

  kitten3: {
    id: 3,
    url: '/fixtures/kitten-3-64-64.jpg',
    packId: 'kitten3',
    emoji: '',
  },

  abe: {
    id: 4,
    url: '/fixtures/512x515-thumbs-up-lincoln.webp',
    packId: 'abe',
    emoji: '',
  },

  wide: {
    id: 5,
    url: '/fixtures/1000x50-green.jpeg',
    packId: 'wide',
    emoji: '',
  },

  tall: {
    id: 6,
    url: '/fixtures/50x1000-teal.jpeg',
    packId: 'tall',
    emoji: '',
  },
};

export const receivedPacks = [
  createPack({ id: 'abe', status: 'downloaded' }, Stickers.abe),
  createPack({ id: 'kitten3', status: 'downloaded' }, Stickers.kitten3),
];

export const installedPacks = [
  createPack({ id: 'kitten1', status: 'installed' }, Stickers.kitten1),
  createPack({ id: 'kitten2', status: 'installed' }, Stickers.kitten2),
  createPack({ id: 'kitten3', status: 'installed' }, Stickers.kitten3),
];

export const blessedPacks = [
  createPack(
    { id: 'wide', status: 'downloaded', isBlessed: true },
    Stickers.wide
  ),
  createPack(
    { id: 'tall', status: 'downloaded', isBlessed: true },
    Stickers.tall
  ),
];

export const knownPacks = [
  createPack({ id: 'kitten1', status: 'known' }, Stickers.kitten1),
  createPack({ id: 'kitten2', status: 'known' }, Stickers.kitten2),
];
