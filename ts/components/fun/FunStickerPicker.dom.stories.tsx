// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useState } from 'react';
import { Button } from 'react-aria-components';
import { action } from '@storybook/addon-actions';
import { type ComponentMeta } from '../../storybook/types.std.js';
import type { FunStickerPickerProps } from './FunStickerPicker.dom.js';
import { FunStickerPicker } from './FunStickerPicker.dom.js';
import { MOCK_RECENT_EMOJIS } from './mocks.dom.js';
import { FunProvider } from './FunProvider.dom.js';
import { packs, recentStickers } from '../stickers/mocks.std.js';
import { EmojiSkinTone } from './data/emojis.std.js';

const { i18n } = window.SignalContext;

type TemplateProps = Omit<
  FunStickerPickerProps,
  'open' | 'onOpenChange' | 'children'
>;

function Template(props: TemplateProps): JSX.Element {
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
      fetchGifsSearch={() => Promise.reject()}
      fetchGifsFeatured={() => Promise.reject()}
      fetchGif={() => Promise.reject()}
      onSelectGif={() => null}
    >
      <FunStickerPicker {...props} open={open} onOpenChange={handleOpenChange}>
        <Button>Open StickerPicker</Button>
      </FunStickerPicker>
    </FunProvider>
  );
}

export default {
  title: 'Components/Fun/FunStickerPicker',
  component: Template,
  args: {
    placement: 'bottom',
    theme: undefined,
    onSelectSticker: action('onSelectSticker'),
    showTimeStickers: false,
    onSelectTimeSticker: undefined,
  },
} satisfies ComponentMeta<TemplateProps>;

export function Default(props: TemplateProps): JSX.Element {
  return <Template {...props} />;
}
