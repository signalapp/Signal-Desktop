// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useState } from 'react';
import { Button } from 'react-aria-components';
import { action } from '@storybook/addon-actions';
import { type ComponentMeta } from '../../storybook/types.std.js';
import type { FunEmojiPickerProps } from './FunEmojiPicker.dom.js';
import { FunEmojiPicker } from './FunEmojiPicker.dom.js';
import { MOCK_RECENT_EMOJIS, MOCK_THIS_MESSAGE_EMOJIS } from './mocks.dom.js';
import { FunProvider } from './FunProvider.dom.js';
import { packs, recentStickers } from '../stickers/mocks.std.js';
import { EmojiSkinTone } from './data/emojis.std.js';
import { Select } from '../Select.dom.js';

const { i18n } = window.SignalContext;

type TemplateProps = Omit<
  FunEmojiPickerProps,
  'open' | 'onOpenChange' | 'children'
>;

const skinToneOptions = [
  { value: EmojiSkinTone.None, text: 'Default' },
  { value: EmojiSkinTone.Type1, text: 'Light Skin Tone' },
  { value: EmojiSkinTone.Type2, text: 'Medium-Light Skin Tone' },
  { value: EmojiSkinTone.Type3, text: 'Medium Skin Tone' },
  { value: EmojiSkinTone.Type4, text: 'Medium-Dark Skin Tone' },
  { value: EmojiSkinTone.Type5, text: 'Dark Skin Tone' },
];

function Template(props: TemplateProps): JSX.Element {
  const [open, setOpen] = useState(true);
  const [skinTone, setSkinTone] = useState(EmojiSkinTone.None);

  const handleOpenChange = useCallback((openState: boolean) => {
    setOpen(openState);
  }, []);

  const handleSkinToneChange = useCallback((value: string) => {
    setSkinTone(value as EmojiSkinTone);
  }, []);

  return (
    <FunProvider
      i18n={i18n}
      // Recents
      recentEmojis={MOCK_RECENT_EMOJIS}
      recentStickers={recentStickers}
      recentGifs={[]}
      // Emojis
      emojiSkinToneDefault={skinTone}
      onEmojiSkinToneDefaultChange={handleSkinToneChange}
      onOpenCustomizePreferredReactionsModal={() => null}
      onSelectEmoji={action('onSelectEmoji')}
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
      <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
        <Select
          ariaLabel="Emoji skin tone"
          options={skinToneOptions}
          value={skinTone}
          onChange={handleSkinToneChange}
          moduleClassName="emoji-skin-tone-select"
        />
        <FunEmojiPicker {...props} open={open} onOpenChange={handleOpenChange}>
          <Button>Open EmojiPicker</Button>
        </FunEmojiPicker>
      </div>
    </FunProvider>
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
    messageEmojis: [],
  },
} satisfies ComponentMeta<TemplateProps>;

export function Default(props: TemplateProps): JSX.Element {
  return <Template {...props} />;
}

export function WithThisMessageReactions(props: TemplateProps): JSX.Element {
  return <Template {...props} messageEmojis={MOCK_THIS_MESSAGE_EMOJIS} />;
}
