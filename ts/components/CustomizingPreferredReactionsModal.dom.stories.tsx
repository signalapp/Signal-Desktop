// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../reactions/constants.std.ts';
import type { PropsType } from './CustomizingPreferredReactionsModal.dom.tsx';
import { CustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal.dom.tsx';
import { EmojiSkinTone } from './fun/data/emojis.std.ts';

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
    draftPreferredReactions: ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'],
    hadSaveError: false,
    i18n,
    isSaving: false,
    onEmojiSkinToneDefaultChange: action('onEmojiSkinToneDefaultChange'),
    originalPreferredReactions: DEFAULT_PREFERRED_REACTION_EMOJI,
    recentEmojis: ['cake'],
    replaceSelectedDraftEmoji: action('replaceSelectedDraftEmoji'),
    resetDraftEmoji: action('resetDraftEmoji'),
    savePreferredReactions: action('savePreferredReactions'),
    selectDraftEmojiToBeReplaced: action('selectDraftEmojiToBeReplaced'),
    selectedDraftEmojiIndex: undefined,
    emojiSkinToneDefault: EmojiSkinTone.Type4,
  };

export function Default(): React.JSX.Element {
  return <CustomizingPreferredReactionsModal {...defaultProps} />;
}

export function DraftEmojiSelected(): React.JSX.Element {
  return (
    <CustomizingPreferredReactionsModal
      {...defaultProps}
      selectedDraftEmojiIndex={4}
    />
  );
}

export function Saving(): React.JSX.Element {
  return <CustomizingPreferredReactionsModal {...defaultProps} isSaving />;
}

export function HadError(): React.JSX.Element {
  return <CustomizingPreferredReactionsModal {...defaultProps} hadSaveError />;
}
