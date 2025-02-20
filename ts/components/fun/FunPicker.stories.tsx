// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { StrictMode } from 'react';
import { Button } from 'react-aria-components';
import { action } from '@storybook/addon-actions';
import enMessages from '../../../_locales/en/messages.json';
import { type ComponentMeta } from '../../storybook/types';
import { setupI18n } from '../../util/setupI18n';
import { packs, recentStickers } from '../stickers/mocks';
import type { FunPickerProps } from './FunPicker';
import { FunPicker } from './FunPicker';
import { FunProvider } from './FunProvider';
import { MOCK_RECENT_EMOJIS } from './mocks';
import { EmojiSkinTone } from './data/emojis';

const i18n = setupI18n('en', enMessages);

type TemplateProps = Omit<FunPickerProps, 'children'>;

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
        defaultEmojiSkinTone={EmojiSkinTone.None}
        onChangeDefaultEmojiSkinTone={() => null}
        // Stickers
        installedStickerPacks={packs}
        showStickerPickerHint={false}
        onClearStickerPickerHint={() => null}
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
    onSelectEmoji: action('onPickEmoji'),
    onSelectSticker: action('onPickSticker'),
    onSelectGif: action('onPickGif'),
    onAddStickerPack: action('onAddStickerPack'),
  },
} satisfies ComponentMeta<TemplateProps>;

export function Default(props: TemplateProps): JSX.Element {
  return <Template {...props} />;
}
