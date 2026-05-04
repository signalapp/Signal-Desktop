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

export function Full(): JSX.Element {
  const title = 'Foo';
  const author = 'Foo McBarrington';

  const pack: StickerPackType = {
    id: 'foo',
    key: 'foo',
    lastUsed: Date.now(),
    cover: abeSticker,
    title,
    isBlessed: true,
    author,
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

  return (
    <StickerPreviewModal
      closeStickerPackPreview={action('closeStickerPackPreview')}
      onClose={action('onClose')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      pack={pack}
    />
  );
}

export function JustFourStickers(): JSX.Element {
  const title = 'Foo';
  const author = 'Foo McBarrington';

  const pack = {
    id: 'foo',
    key: 'foo',
    lastUsed: Date.now(),
    cover: abeSticker,
    title,
    isBlessed: true,
    author,
    status: 'downloaded' as const,
    stickerCount: 101,
    stickers: [abeSticker, abeSticker, abeSticker, abeSticker],
  };

  return (
    <StickerPreviewModal
      closeStickerPackPreview={action('closeStickerPackPreview')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      pack={pack}
    />
  );
}

export function InitialDownload(): JSX.Element {
  return (
    <StickerPreviewModal
      closeStickerPackPreview={action('closeStickerPackPreview')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      //  oxlint-disable-next-line typescript/no-explicit-any
      pack={{} as any}
    />
  );
}

export function PackDeleted(): JSX.Element {
  return (
    <StickerPreviewModal
      closeStickerPackPreview={action('closeStickerPackPreview')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      pack={undefined}
    />
  );
}
