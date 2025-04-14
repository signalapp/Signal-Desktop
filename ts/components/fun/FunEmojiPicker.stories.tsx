// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { StrictMode, useCallback, useState } from 'react';
import { Button } from 'react-aria-components';
import { action } from '@storybook/addon-actions';
import { type ComponentMeta } from '../../storybook/types';
import type { FunEmojiPickerProps } from './FunEmojiPicker';
import { FunEmojiPicker } from './FunEmojiPicker';
import { MOCK_RECENT_EMOJIS } from './mocks';
import { FunProvider } from './FunProvider';
import { packs, recentStickers } from '../stickers/mocks';
import { EmojiSkinTone } from './data/emojis';

const { i18n } = window.SignalContext;

type TemplateProps = Omit<
  FunEmojiPickerProps,
  'open' | 'onOpenChange' | 'children'
>;

function Template(props: TemplateProps): JSX.Element {
  const [open, setOpen] = useState(true);

  const handleOpenChange = useCallback((openState: boolean) => {
    setOpen(openState);
  }, []);

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
        <FunEmojiPicker {...props} open={open} onOpenChange={handleOpenChange}>
          <Button>Open EmojiPicker</Button>
        </FunEmojiPicker>
      </FunProvider>
    </StrictMode>
  );
}

export default {
  title: 'Components/Fun/FunEmojiPicker',
  component: Template,
  args: {
    placement: 'bottom',
    theme: undefined,
    onSelectEmoji: action('onSelectEmoji'),
    showCustomizePreferredReactionsButton: false,
    closeOnSelect: true,
  },
} satisfies ComponentMeta<TemplateProps>;

export function Default(props: TemplateProps): JSX.Element {
  return <Template {...props} />;
}
