// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StickerPicker';
import { StickerPicker } from './StickerPicker';
import { abeSticker, createPack, packs, recentStickers } from './mocks';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Stickers/StickerPicker',
  component: StickerPicker,
  argTypes: {
    showPickerHint: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    onClickAddPack: action('onClickAddPack'),
    onClose: action('onClose'),
    onPickSticker: action('onPickSticker'),
    packs: [],
    recentStickers: [],
    showPickerHint: false,
  },
} satisfies Meta<Props>;

export function Full(args: Props): JSX.Element {
  return (
    <StickerPicker {...args} packs={packs} recentStickers={recentStickers} />
  );
}

export function PickerHint(args: Props): JSX.Element {
  return (
    <StickerPicker
      {...args}
      packs={packs}
      recentStickers={recentStickers}
      showPickerHint
    />
  );
}

export function NoRecentStickers(args: Props): JSX.Element {
  return <StickerPicker {...args} packs={packs} />;
}

export function Empty(args: Props): JSX.Element {
  return <StickerPicker {...args} />;
}

export function PendingDownload(args: Props): JSX.Element {
  const pack = createPack(
    { status: 'pending', stickers: [abeSticker] },
    abeSticker
  );

  return <StickerPicker {...args} packs={[pack]} />;
}

export function Error(args: Props): JSX.Element {
  const pack = createPack(
    { status: 'error', stickers: [abeSticker] },
    abeSticker
  );

  return <StickerPicker {...args} packs={[pack]} />;
}

export function NoCover(args: Props): JSX.Element {
  const pack = createPack({ status: 'error', stickers: [abeSticker] });
  return <StickerPicker {...args} packs={[pack]} />;
}
