// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
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
} from './mocks';

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
  ],
  argTypes: {
    showIntroduction: { control: { type: 'boolean' } },
    showPickerHint: { control: { type: 'boolean' } },
  },
  args: {
    blessedPacks: [],
    clearInstalledStickerPack: action('clearInstalledStickerPack'),
    clearShowIntroduction: action('clearShowIntroduction'),
    clearShowPickerHint: action('clearShowPickerHint'),
    i18n,
    installedPacks: [],
    knownPacks: [],
    onClickAddPack: action('onClickAddPack'),
    onPickSticker: action('onPickSticker'),
    receivedPacks: [],
    recentStickers: [],
    showIntroduction: false,
    showPickerHint: false,
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

export function OnlyInstalled(args: Props): JSX.Element {
  return <StickerButton {...args} installedPacks={installedPacks} />;
}

export function OnlyReceived(args: Props): JSX.Element {
  return <StickerButton {...args} receivedPacks={receivedPacks} />;
}

export function OnlyKnown(args: Props): JSX.Element {
  return <StickerButton {...args} knownPacks={knownPacks} />;
}

export function OnlyBlessed(args: Props): JSX.Element {
  return <StickerButton {...args} blessedPacks={blessedPacks} />;
}

export function NoPacks(args: Props): JSX.Element {
  return <StickerButton {...args} />;
}

export function InstalledPackTooltip(args: Props): JSX.Element {
  return (
    <StickerButton
      {...args}
      installedPacks={installedPacks}
      installedPack={installedPacks[0]}
    />
  );
}

export function InstalledPackTooltipWide(args: Props): JSX.Element {
  const installedPack = createPack({ id: 'installed-pack-wide' }, wideSticker);

  return (
    <StickerButton
      {...args}
      installedPacks={[installedPack]}
      installedPack={installedPack}
    />
  );
}

export function InstalledPackTooltipTall(args: Props): JSX.Element {
  const installedPack = createPack({ id: 'installed-pack-tall' }, tallSticker);
  return (
    <StickerButton
      {...args}
      installedPacks={[installedPack]}
      installedPack={installedPack}
    />
  );
}

export function NewInstallTooltip(args: Props): JSX.Element {
  return (
    <StickerButton {...args} installedPacks={installedPacks} showIntroduction />
  );
}
