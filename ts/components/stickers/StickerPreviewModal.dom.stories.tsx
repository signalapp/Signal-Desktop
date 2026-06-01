// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './StickerPreviewModal.dom.tsx';
import { StickerPreviewModal } from './StickerPreviewModal.dom.tsx';
import {
  landscapeGreenUrl,
  portraitTealUrl,
  squareStickerUrl,
} from '../../storybook/Fixtures.std.ts';
import type {
  StickerPackType,
  StickerType,
} from '../../state/ducks/stickers.preload.ts';
import { Emoji } from '../../axo/emoji.std.ts';
import { STICKER_PACK_DEFAULTS } from '../../sql/Interface.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Stickers/StickerPreviewModal',
  argTypes: {},
  args: {},
} satisfies Meta<Props>;

const abeSticker: StickerType = {
  id: -1,
  emoji: Emoji.TOPHAT,
  url: squareStickerUrl,
  packId: 'abe',
};
const wideSticker: StickerType = {
  id: -2,
  emoji: Emoji.EXPLODING_HEAD,
  url: landscapeGreenUrl,
  packId: 'wide',
};
const tallSticker: StickerType = {
  id: -3,
  emoji: Emoji.FIRE,
  url: portraitTealUrl,
  packId: 'tall',
};

const pack: StickerPackType = {
  id: 'foo',
  key: 'foo',
  lastUsed: Date.now(),
  cover: abeSticker,
  title: 'Foo',
  isBlessed: false,
  author: 'Foo McBarrington',
  status: 'downloaded' as const,
  stickerCount: 101,
  stickers: [
    wideSticker,
    tallSticker,
    ...Array(101)
      .fill(0)
      .map((_n, id) => ({ ...abeSticker, id })),
  ],
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  closeStickerPackPreview: action('closeStickerPackPreview'),
  downloadStickerPack: action('downloadStickerPack'),
  i18n,
  installStickerPack: action('installStickerPack'),
  showToast: action('showToast'),
  uninstallStickerPack: action('uninstallStickerPack'),
  pack: overrideProps.pack ?? pack,
});

export function Pack(): JSX.Element {
  const props = createProps();
  return <StickerPreviewModal {...props} />;
}

export function OfficialPack(): JSX.Element {
  const blessedPack = {
    ...pack,
    isBlessed: true,
  };
  const props = createProps({ pack: blessedPack });
  return <StickerPreviewModal {...props} />;
}

export function SmallPack(): JSX.Element {
  const smallPack = {
    ...pack,
    stickerCount: 4,
    stickers: [abeSticker, abeSticker, abeSticker, abeSticker],
  };
  const props = createProps({ pack: smallPack });
  return <StickerPreviewModal {...props} />;
}

export function PackInstalled(): JSX.Element {
  const installedPack = {
    ...pack,
    status: 'installed' as const,
  };
  const props = createProps({ pack: installedPack });
  return <StickerPreviewModal {...props} />;
}

export function PackInstallPending(): JSX.Element {
  const pendingPack = {
    ...pack,
    status: 'pending' as const,
  };
  const props = createProps({ pack: pendingPack });
  return <StickerPreviewModal {...props} />;
}

export function InitialDownload(): JSX.Element {
  const installingPack = {
    ...STICKER_PACK_DEFAULTS,
    isBlessed: false,
    stickers: [],
  };
  const props = createProps({ pack: installingPack });
  return <StickerPreviewModal {...props} />;
}

export function PackDeleted(): JSX.Element {
  const props = createProps();
  return <StickerPreviewModal {...props} pack={undefined} />;
}

export function PackError(): JSX.Element {
  const errorPack = {
    ...pack,
    status: 'error' as const,
  };
  const props = createProps({ pack: errorPack });
  return <StickerPreviewModal {...props} />;
}
