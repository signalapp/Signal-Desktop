// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './StickerPreviewModal.dom.js';
import { StickerPreviewModal } from './StickerPreviewModal.dom.js';
import {
  landscapeGreenUrl,
  portraitTealUrl,
  squareStickerUrl,
} from '../../storybook/Fixtures.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Stickers/StickerPreviewModal',
  argTypes: {},
  args: {},
} satisfies Meta<Props>;

const abeSticker = {
  id: -1,
  emoji: '🎩',
  url: squareStickerUrl,
  packId: 'abe',
};
const wideSticker = {
  id: -2,
  emoji: '🤯',
  url: landscapeGreenUrl,
  packId: 'wide',
};
const tallSticker = {
  id: -3,
  emoji: '🔥',
  url: portraitTealUrl,
  packId: 'tall',
};

export function Full(): JSX.Element {
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
      //  eslint-disable-next-line @typescript-eslint/no-explicit-any
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
