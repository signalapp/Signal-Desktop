// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StickerButton';
import { StickerButton } from './StickerButton';
import {
  createPack,
  sticker1,
  sticker2,
  tallSticker,
  wideSticker,
} from './StickerPicker.stories';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Stickers/StickerButton', module);

story.addDecorator(storyFn => (
  <div
    style={{
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    }}
  >
    {storyFn()}
  </div>
));

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
  clearInstalledStickerPack: action('clearInstalledStickerPack'),
  clearShowIntroduction: action('clearShowIntroduction'),
  clearShowPickerHint: action('clearShowPickerHint'),
  i18n,
  installedPack: overrideProps.installedPack,
  installedPacks: overrideProps.installedPacks || [],
  knownPacks: overrideProps.knownPacks || [],
  onClickAddPack: action('onClickAddPack'),
  onPickSticker: action('onPickSticker'),
  receivedPacks: overrideProps.receivedPacks || [],
  recentStickers: [],
  showIntroduction: boolean(
    'showIntroduction',
    overrideProps.showIntroduction || false
  ),
  showPickerHint: boolean('showPickerHint', false),
});

story.add('Only Installed', () => {
  const props = createProps({ installedPacks });

  return <StickerButton {...props} />;
});

story.add('Only Received', () => {
  const props = createProps({ receivedPacks });

  return <StickerButton {...props} />;
});

story.add('Only Known', () => {
  const props = createProps({ knownPacks });

  return <StickerButton {...props} />;
});

story.add('Only Blessed', () => {
  const props = createProps({ blessedPacks });

  return <StickerButton {...props} />;
});

story.add('No Packs', () => {
  const props = createProps();

  return <StickerButton {...props} />;
});

story.add('Installed Pack Tooltip', () => {
  const props = createProps({
    installedPacks,
    installedPack: installedPacks[0],
  });

  return <StickerButton {...props} />;
});

story.add('Installed Pack Tooltip (Wide)', () => {
  const installedPack = createPack({ id: 'installed-pack-wide' }, wideSticker);

  const props = createProps({
    installedPacks: [installedPack],
    installedPack,
  });

  return <StickerButton {...props} />;
});

story.add('Installed Pack Tooltip (Tall)', () => {
  const installedPack = createPack({ id: 'installed-pack-tall' }, tallSticker);

  const props = createProps({
    installedPacks: [installedPack],
    installedPack,
  });

  return <StickerButton {...props} />;
});

story.add('New Install Tooltip', () => {
  const props = createProps({
    installedPacks,
    showIntroduction: true,
  });

  return <StickerButton {...props} />;
});
