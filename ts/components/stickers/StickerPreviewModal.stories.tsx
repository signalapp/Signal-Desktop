// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { StickerPreviewModal } from './StickerPreviewModal';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import {
  landscapeGreenUrl,
  portraitTealUrl,
  squareStickerUrl,
} from '../../storybook/Fixtures';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Stickers/StickerPreviewModal',
};

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

export const Full = (): JSX.Element => {
  const title = text('title', 'Foo');
  const author = text('author', 'Foo McBarrington');

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
      onClose={action('onClose')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      pack={pack}
    />
  );
};

export const JustFourStickers = (): JSX.Element => {
  const title = text('title', 'Foo');
  const author = text('author', 'Foo McBarrington');

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
      onClose={action('onClose')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      pack={pack}
    />
  );
};

JustFourStickers.story = {
  name: 'Just four stickers',
};

export const InitialDownload = (): JSX.Element => {
  return (
    <StickerPreviewModal
      onClose={action('onClose')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      //  eslint-disable-next-line @typescript-eslint/no-explicit-any
      pack={{} as any}
    />
  );
};

InitialDownload.story = {
  name: 'Initial download',
};

export const PackDeleted = (): JSX.Element => {
  return (
    <StickerPreviewModal
      onClose={action('onClose')}
      installStickerPack={action('installStickerPack')}
      uninstallStickerPack={action('uninstallStickerPack')}
      downloadStickerPack={action('downloadStickerPack')}
      i18n={i18n}
      pack={undefined}
    />
  );
};

PackDeleted.story = {
  name: 'Pack deleted',
};
