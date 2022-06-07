// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DecoratorFunction } from '@storybook/addons';
import * as React from 'react';
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

export default {
  title: 'Components/Stickers/StickerButton',
  decorators: [
    storyFn => (
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
    ),
  ] as Array<DecoratorFunction<JSX.Element>>,
};

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

export const OnlyInstalled = (): JSX.Element => {
  const props = createProps({ installedPacks });

  return <StickerButton {...props} />;
};

export const OnlyReceived = (): JSX.Element => {
  const props = createProps({ receivedPacks });

  return <StickerButton {...props} />;
};

export const OnlyKnown = (): JSX.Element => {
  const props = createProps({ knownPacks });

  return <StickerButton {...props} />;
};

export const OnlyBlessed = (): JSX.Element => {
  const props = createProps({ blessedPacks });

  return <StickerButton {...props} />;
};

export const NoPacks = (): JSX.Element => {
  const props = createProps();

  return <StickerButton {...props} />;
};

export const InstalledPackTooltip = (): JSX.Element => {
  const props = createProps({
    installedPacks,
    installedPack: installedPacks[0],
  });

  return <StickerButton {...props} />;
};

export const InstalledPackTooltipWide = (): JSX.Element => {
  const installedPack = createPack({ id: 'installed-pack-wide' }, wideSticker);

  const props = createProps({
    installedPacks: [installedPack],
    installedPack,
  });

  return <StickerButton {...props} />;
};

InstalledPackTooltipWide.story = {
  name: 'Installed Pack Tooltip (Wide)',
};

export const InstalledPackTooltipTall = (): JSX.Element => {
  const installedPack = createPack({ id: 'installed-pack-tall' }, tallSticker);

  const props = createProps({
    installedPacks: [installedPack],
    installedPack,
  });

  return <StickerButton {...props} />;
};

InstalledPackTooltipTall.story = {
  name: 'Installed Pack Tooltip (Tall)',
};

export const NewInstallTooltip = (): JSX.Element => {
  const props = createProps({
    installedPacks,
    showIntroduction: true,
  });

  return <StickerButton {...props} />;
};
