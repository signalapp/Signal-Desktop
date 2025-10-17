// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './StickerManager.dom.js';
import { StickerManager } from './StickerManager.dom.js';
import { createPack, sticker1, sticker2 } from './mocks.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Stickers/StickerManager',
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
    { id: 'blessed-pack-1', status: 'downloaded', isBlessed: true },
    sticker1
  ),
  createPack(
    { id: 'blessed-pack-2', status: 'downloaded', isBlessed: true },
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
  i18n,
  installStickerPack: action('installStickerPack'),
  installedPacks: overrideProps.installedPacks || [],
  knownPacks: overrideProps.knownPacks || [],
  receivedPacks: overrideProps.receivedPacks || [],
  uninstallStickerPack: action('uninstallStickerPack'),
});

export function Full(): JSX.Element {
  const props = createProps({ installedPacks, receivedPacks, blessedPacks });

  return <StickerManager {...props} />;
}

export function InstalledPacks(): JSX.Element {
  const props = createProps({ installedPacks });

  return <StickerManager {...props} />;
}

export function ReceivedPacks(): JSX.Element {
  const props = createProps({ receivedPacks });

  return <StickerManager {...props} />;
}

export function InstalledAndKnownPacks(): JSX.Element {
  const props = createProps({ installedPacks, knownPacks });

  return <StickerManager {...props} />;
}

export function Empty(): JSX.Element {
  const props = createProps();

  return <StickerManager {...props} />;
}
