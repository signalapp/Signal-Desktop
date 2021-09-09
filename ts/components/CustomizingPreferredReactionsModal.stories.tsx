// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ComponentProps } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

import { CustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal';

const i18n = setupI18n('en', enMessages);
const story = storiesOf(
  'Components/CustomizingPreferredReactionsModal',
  module
);

const defaultProps: ComponentProps<
  typeof CustomizingPreferredReactionsModal
> = {
  cancelCustomizePreferredReactionsModal: action(
    'cancelCustomizePreferredReactionsModal'
  ),
  deselectDraftEmoji: action('deselectDraftEmoji'),
  draftPreferredReactions: [
    'sparkles',
    'sparkle',
    'sparkler',
    'shark',
    'sparkling_heart',
    'thumbsup',
  ],
  hadSaveError: false,
  i18n,
  isSaving: false,
  onSetSkinTone: action('onSetSkinTone'),
  originalPreferredReactions: [
    'heart',
    'thumbsup',
    'thumbsdown',
    'joy',
    'open_mouth',
    'cry',
  ],
  replaceSelectedDraftEmoji: action('replaceSelectedDraftEmoji'),
  resetDraftEmoji: action('resetDraftEmoji'),
  savePreferredReactions: action('savePreferredReactions'),
  selectDraftEmojiToBeReplaced: action('selectDraftEmojiToBeReplaced'),
  selectedDraftEmojiIndex: undefined,
  skinTone: 4,
};

story.add('Default', () => (
  <CustomizingPreferredReactionsModal {...defaultProps} />
));

story.add('Draft emoji selected', () => (
  <CustomizingPreferredReactionsModal
    {...defaultProps}
    selectedDraftEmojiIndex={4}
  />
));

story.add('Saving', () => (
  <CustomizingPreferredReactionsModal {...defaultProps} isSaving />
));

story.add('Had error', () => (
  <CustomizingPreferredReactionsModal {...defaultProps} hadSaveError />
));
