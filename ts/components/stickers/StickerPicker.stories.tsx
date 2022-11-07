// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { sample } from 'lodash';
import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StickerPicker';
import { StickerPicker } from './StickerPicker';
import type { StickerType } from '../../state/ducks/stickers';
import {
  abeSticker,
  createPack,
  sticker1,
  sticker2,
  sticker3,
  tallSticker,
  wideSticker,
} from './_fixtures';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Stickers/StickerPicker',
};

const choosableStickers = [sticker1, sticker2, sticker3, abeSticker];

const packs = [
  createPack({ id: 'tall' }, tallSticker),
  createPack({ id: 'wide' }, wideSticker),
  ...Array(20)
    .fill(0)
    .map((_, n) =>
      createPack({ id: `pack-${n}` }, sample(choosableStickers) as StickerType)
    ),
];

const recentStickers = [
  abeSticker,
  sticker1,
  sticker2,
  sticker3,
  tallSticker,
  wideSticker,
  { ...sticker2, id: 9999 },
];

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  onClickAddPack: action('onClickAddPack'),
  onClose: action('onClose'),
  onPickSticker: action('onPickSticker'),
  packs: overrideProps.packs || [],
  recentStickers: overrideProps.recentStickers || [],
  showPickerHint: boolean(
    'showPickerHint',
    overrideProps.showPickerHint || false
  ),
});

export function Full(): JSX.Element {
  const props = createProps({ packs, recentStickers });

  return <StickerPicker {...props} />;
}

export function PickerHint(): JSX.Element {
  const props = createProps({ packs, recentStickers, showPickerHint: true });

  return <StickerPicker {...props} />;
}

export function NoRecentStickers(): JSX.Element {
  const props = createProps({ packs });

  return <StickerPicker {...props} />;
}

export function Empty(): JSX.Element {
  const props = createProps();

  return <StickerPicker {...props} />;
}

export function PendingDownload(): JSX.Element {
  const pack = createPack(
    { status: 'pending', stickers: [abeSticker] },
    abeSticker
  );
  const props = createProps({ packs: [pack] });

  return <StickerPicker {...props} />;
}

export function Error(): JSX.Element {
  const pack = createPack(
    { status: 'error', stickers: [abeSticker] },
    abeSticker
  );
  const props = createProps({ packs: [pack] });

  return <StickerPicker {...props} />;
}

export function NoCover(): JSX.Element {
  const pack = createPack({ status: 'error', stickers: [abeSticker] });
  const props = createProps({ packs: [pack] });

  return <StickerPicker {...props} />;
}
