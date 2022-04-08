// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
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

const book = storiesOf('Components/Stickers/StickerPreviewModal', module);

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

book.add('Full', () => {
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
});

book.add('Just four stickers', () => {
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
});

book.add('Initial download', () => {
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
});

book.add('Pack deleted', () => {
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
});
