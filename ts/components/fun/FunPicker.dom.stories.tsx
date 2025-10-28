// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useState } from 'react';
import { Button } from 'react-aria-components';
import { action } from '@storybook/addon-actions';
import { type ComponentMeta } from '../../storybook/types.std.js';
import { packs, recentStickers } from '../stickers/mocks.std.js';
import type { FunPickerProps } from './FunPicker.dom.js';
import { FunPicker } from './FunPicker.dom.js';
import { FunProvider } from './FunProvider.dom.js';
import {
  MOCK_GIFS_PAGINATED_ONE_PAGE,
  MOCK_RECENT_EMOJIS,
} from './mocks.dom.js';
import { EmojiSkinTone } from './data/emojis.std.js';

const { i18n } = window.SignalContext;

type TemplateProps = Omit<FunPickerProps, 'open' | 'onOpenChange' | 'children'>;

function Template(props: TemplateProps) {
  const [open, setOpen] = useState(true);

  const handleOpenChange = useCallback((openState: boolean) => {
    setOpen(openState);
  }, []);

  return (
    <FunProvider
      i18n={i18n}
      // Recents
      recentEmojis={MOCK_RECENT_EMOJIS}
      recentStickers={recentStickers}
      recentGifs={[]}
      // Emojis
      emojiSkinToneDefault={EmojiSkinTone.None}
      onEmojiSkinToneDefaultChange={() => null}
      onOpenCustomizePreferredReactionsModal={() => null}
      onSelectEmoji={() => null}
      // Stickers
      installedStickerPacks={packs}
      showStickerPickerHint={false}
      onClearStickerPickerHint={() => null}
      onSelectSticker={() => null}
      // Gifs
      fetchGifsSearch={() => Promise.resolve(MOCK_GIFS_PAGINATED_ONE_PAGE)}
      fetchGifsFeatured={() => Promise.resolve(MOCK_GIFS_PAGINATED_ONE_PAGE)}
      fetchGif={() => Promise.resolve(new Blob([new Uint8Array(1)]))}
      onSelectGif={() => null}
    >
      <FunPicker {...props} open={open} onOpenChange={handleOpenChange}>
        <Button>Open FunPicker</Button>
      </FunPicker>
    </FunProvider>
  );
}

export default {
  title: 'Components/Fun/FunPicker',
  component: Template,
  args: {
    placement: 'bottom',
    theme: undefined,
    onSelectEmoji: action('onSelectEmoji'),
    onSelectSticker: action('onSelectSticker'),
    onSelectGif: action('onSelectGif'),
    onAddStickerPack: action('onAddStickerPack'),
  },
} satisfies ComponentMeta<TemplateProps>;

export function Default(props: TemplateProps): JSX.Element {
  return <Template {...props} />;
}
