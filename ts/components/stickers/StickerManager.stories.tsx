// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StickerManager';
import { StickerManager } from './StickerManager';
import { createPack, sticker1, sticker2 } from './StickerPicker.stories';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Stickers/StickerManager', module);

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
  downloadStickerPack: action('downloadStickerPack'),
  i18n,
  installStickerPack: action('installStickerPack'),
  installedPacks: overrideProps.installedPacks || [],
  knownPacks: overrideProps.knownPacks || [],
  receivedPacks: overrideProps.receivedPacks || [],
  uninstallStickerPack: action('uninstallStickerPack'),
});

story.add('Full', () => {
  const props = createProps({ installedPacks, receivedPacks, blessedPacks });

  return <StickerManager {...props} />;
});

story.add('Installed Packs', () => {
  const props = createProps({ installedPacks });

  return <StickerManager {...props} />;
});

story.add('Received Packs', () => {
  const props = createProps({ receivedPacks });

  return <StickerManager {...props} />;
});

story.add('Installed + Known Packs', () => {
  const props = createProps({ installedPacks, knownPacks });

  return <StickerManager {...props} />;
});

story.add('Empty', () => {
  const props = createProps();

  return <StickerManager {...props} />;
});
