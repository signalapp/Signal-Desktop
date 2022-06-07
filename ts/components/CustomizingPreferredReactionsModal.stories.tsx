// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { CustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/CustomizingPreferredReactionsModal',
};

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
    originalPreferredReactions: ['❤️', '👍', '👎', '😂', '😮', '😢'],
    recentEmojis: ['cake'],
    replaceSelectedDraftEmoji: action('replaceSelectedDraftEmoji'),
    resetDraftEmoji: action('resetDraftEmoji'),
    savePreferredReactions: action('savePreferredReactions'),
    selectDraftEmojiToBeReplaced: action('selectDraftEmojiToBeReplaced'),
    selectedDraftEmojiIndex: undefined,
    skinTone: 4,
  };

export const Default = (): JSX.Element => (
  <CustomizingPreferredReactionsModal {...defaultProps} />
);

export const DraftEmojiSelected = (): JSX.Element => (
  <CustomizingPreferredReactionsModal
    {...defaultProps}
    selectedDraftEmojiIndex={4}
  />
);

DraftEmojiSelected.story = {
  name: 'Draft emoji selected',
};

export const Saving = (): JSX.Element => (
  <CustomizingPreferredReactionsModal {...defaultProps} isSaving />
);

export const HadError = (): JSX.Element => (
  <CustomizingPreferredReactionsModal {...defaultProps} hadSaveError />
);

HadError.story = {
  name: 'Had error',
};
