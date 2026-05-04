// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps, JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CustomizingPreferredReactionsModal.dom.tsx';
import { CustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal.dom.tsx';
import { Emoji } from '../axo/emoji.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CustomizingPreferredReactionsModal',
} satisfies Meta<PropsType>;

const defaultProps: ComponentProps<typeof CustomizingPreferredReactionsModal> =
  {
    cancelCustomizePreferredReactionsModal: action(
      'cancelCustomizePreferredReactionsModal'
    ),
    deselectDraftEmoji: action('deselectDraftEmoji'),
    draftPreferredReactions: [
      Emoji.SPARKLES,
      Emoji.SPARKLE,
      Emoji.FIREWORK_SPARKLER,
      Emoji.SHARK,
      Emoji.SPARKLING_HEART,
      Emoji.PARKING,
    ],
    hadSaveError: false,
    i18n,
    isSaving: false,
    onEmojiSkinToneDefaultChange: action('onEmojiSkinToneDefaultChange'),
    originalPreferredReactions: Emoji.getDefaultPreferredReactionEmojis(
      Emoji.SkinTone.None
    ),
    recentEmojis: [Emoji.CAKE],
    replaceSelectedDraftEmoji: action('replaceSelectedDraftEmoji'),
    resetDraftEmoji: action('resetDraftEmoji'),
    savePreferredReactions: action('savePreferredReactions'),
    selectDraftEmojiToBeReplaced: action('selectDraftEmojiToBeReplaced'),
    selectedDraftEmojiIndex: undefined,
    emojiSkinToneDefault: Emoji.SkinTone.Type4,
  };

export function Default(): JSX.Element {
  return <CustomizingPreferredReactionsModal {...defaultProps} />;
}

export function DraftEmojiSelected(): JSX.Element {
  return (
    <CustomizingPreferredReactionsModal
      {...defaultProps}
      selectedDraftEmojiIndex={4}
    />
  );
}

export function Saving(): JSX.Element {
  return <CustomizingPreferredReactionsModal {...defaultProps} isSaving />;
}

export function HadError(): JSX.Element {
  return <CustomizingPreferredReactionsModal {...defaultProps} hadSaveError />;
}
