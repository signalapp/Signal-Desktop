// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { StrictMode } from 'react';
import { Button } from 'react-aria-components';
import { action } from '@storybook/addon-actions';
import { type ComponentMeta } from '../../storybook/types';
import { packs, recentStickers } from '../stickers/mocks';
import type { FunPickerProps } from './FunPicker';
import { FunPicker } from './FunPicker';
import type { FunProviderProps } from './FunProvider';
import { FunProvider } from './FunProvider';
import { MOCK_GIFS_PAGINATED_ONE_PAGE, MOCK_RECENT_EMOJIS } from './mocks';
import { EmojiSkinTone } from './data/emojis';

const { i18n } = window.SignalContext;

type TemplateProps = Omit<FunPickerProps, 'children'> &
  Pick<FunProviderProps, 'fetchGifsSearch' | 'fetchGifsFeatured' | 'fetchGif'>;

function Template(props: TemplateProps) {
  return (
    <StrictMode>
      <FunProvider
        i18n={i18n}
        // Recents
        recentEmojis={MOCK_RECENT_EMOJIS}
        recentStickers={recentStickers}
        recentGifs={[]}
        // Emojis
        emojiSkinToneDefault={EmojiSkinTone.None}
        onEmojiSkinToneDefaultChange={() => null}
        // Stickers
        installedStickerPacks={packs}
        showStickerPickerHint={false}
        onClearStickerPickerHint={() => null}
        // Gifs
        fetchGifsSearch={props.fetchGifsSearch}
        fetchGifsFeatured={props.fetchGifsFeatured}
        fetchGif={props.fetchGif}
      >
        <FunPicker {...props}>
          <Button>Open FunPicker</Button>
        </FunPicker>
      </FunProvider>
    </StrictMode>
  );
}

export default {
  title: 'Components/Fun/FunPicker',
  component: Template,
  args: {
    placement: 'bottom',
    defaultOpen: true,
    onOpenChange: action('onOpenChange'),
    onSelectEmoji: action('onSelectEmoji'),
    onSelectSticker: action('onSelectSticker'),
    onSelectGif: action('onSelectGif'),
    onAddStickerPack: action('onAddStickerPack'),
    fetchGifsSearch: () => Promise.resolve(MOCK_GIFS_PAGINATED_ONE_PAGE),
    fetchGifsFeatured: () => Promise.resolve(MOCK_GIFS_PAGINATED_ONE_PAGE),
    fetchGif: () => Promise.resolve(new Blob([new Uint8Array(1)])),
  },
} satisfies ComponentMeta<TemplateProps>;

export function Default(props: TemplateProps): JSX.Element {
  return <Template {...props} />;
}
