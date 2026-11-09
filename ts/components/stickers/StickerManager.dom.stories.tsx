// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './StickerManager.dom.tsx';
import { StickerManager } from './StickerManager.dom.tsx';
import {
  createPack,
  sticker1,
  sticker2,
} from '../../test-helpers/stickersMocks.std.ts';
import type { StickerPackType } from '../../state/ducks/stickers.preload.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Stickers/StickerManager',
  argTypes: {
    tab: {
      options: ['all', 'my-stickers'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<Props>;

const receivedPacks = [
  createPack({ id: 'received-pack-1', status: 'downloaded' }, sticker1),
  createPack({ id: 'received-pack-2', status: 'downloaded' }, sticker2),
];

const installedPacks = [
  createPack({ id: 'installed-pack-1', status: 'installed' }, sticker1),
  createPack({ id: 'installed-pack-2', status: 'installed' }, sticker2),
];

const blessedPacks = [
  createPack(
    {
      id: 'blessed-pack-1',
      status: 'downloaded',
      isBlessed: true,
      author: 'Ann Chovy',
    },
    sticker1
  ),
  createPack(
    {
      id: 'blessed-pack-2',
      status: 'downloaded',
      isBlessed: true,
      author: 'Tom Ato',
    },
    sticker2
  ),
];

const knownPacks = [
  createPack({ id: 'known-pack-1', status: 'known' }, sticker1),
  createPack({ id: 'known-pack-2', status: 'known' }, sticker2),
];

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  blessedPacks: overrideProps.blessedPacks || [],
  closeStickerPackPreview: action('closeStickerPackPreview'),
  downloadStickerPack: action('downloadStickerPack'),
  favoriteStickers: overrideProps.favoriteStickers || [],
  i18n,
  installStickerPack: action('installStickerPack'),
  installedPacks: overrideProps.installedPacks || [],
  isFavoriteStickersEnabled: true,
  knownPacks: overrideProps.knownPacks || [],
  markStickerAsFavorite: action('markStickerAsFavorite'),
  receivedPacks: overrideProps.receivedPacks || [],
  tab: overrideProps.tab || 'all',
  setTab: action('setTab'),
  showToast: action('showToast'),
  uninstallStickerPack: action('uninstallStickerPack'),
  updateStickerPacksPositions: action('updateStickerPacksPositions'),
});

export function Full(args: Props): JSX.Element {
  const props = createProps({ blessedPacks, installedPacks, receivedPacks });

  return <StickerManager {...props} {...args} />;
}

export function ReceivedPacks(args: Props): JSX.Element {
  const props = createProps({ blessedPacks, receivedPacks });

  return <StickerManager {...props} {...args} />;
}

export function InstalledPacks(args: Props): JSX.Element {
  const blessedPacksWithInstalled = [
    { ...blessedPacks[0], status: 'installed' },
    blessedPacks[1],
  ] as Array<StickerPackType>;
  const props = createProps({
    blessedPacks: blessedPacksWithInstalled,
    installedPacks,
    receivedPacks: installedPacks,
  });

  return <StickerManager {...props} {...args} />;
}

export function InstalledAndKnownPacks(args: Props): JSX.Element {
  const props = createProps({
    blessedPacks,
    knownPacks,
    installedPacks,
    receivedPacks: installedPacks,
  });

  return <StickerManager {...props} {...args} />;
}

export function Empty(args: Props): JSX.Element {
  const props = createProps();

  return <StickerManager {...props} {...args} />;
}
