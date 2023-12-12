// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../reactions/constants';
import enMessages from '../../_locales/en/messages.json';

import type { PropsType } from './CustomizingPreferredReactionsModal';
import { CustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal';

const i18n = setupI18n('en', enMessages);

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
    onSetSkinTone: action('onSetSkinTone'),
    originalPreferredReactions: DEFAULT_PREFERRED_REACTION_EMOJI,
    recentEmojis: ['cake'],
    replaceSelectedDraftEmoji: action('replaceSelectedDraftEmoji'),
    resetDraftEmoji: action('resetDraftEmoji'),
    savePreferredReactions: action('savePreferredReactions'),
    selectDraftEmojiToBeReplaced: action('selectDraftEmojiToBeReplaced'),
    selectedDraftEmojiIndex: undefined,
    skinTone: 4,
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
