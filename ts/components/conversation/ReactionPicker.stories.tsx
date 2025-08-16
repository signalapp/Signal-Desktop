// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props as ReactionPickerProps } from './ReactionPicker';
import { ReactionPicker } from './ReactionPicker';
import { EmojiPicker } from '../emoji/EmojiPicker';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../../reactions/constants';
import { EmojiSkinTone } from '../fun/data/emojis';

const { i18n } = window.SignalContext;

const renderEmojiPicker: ReactionPickerProps['renderEmojiPicker'] = ({
  onClose,
  onPickEmoji,
  onEmojiSkinToneDefaultChange,
  ref,
}) => (
  <EmojiPicker
    i18n={i18n}
    emojiSkinToneDefault={EmojiSkinTone.None}
    ref={ref}
    onClose={onClose}
    onPickEmoji={onPickEmoji}
    onEmojiSkinToneDefaultChange={onEmojiSkinToneDefaultChange}
    wasInvokedFromKeyboard={false}
  />
);

export default {
  title: 'Components/Conversation/ReactionPicker',
} satisfies Meta<ReactionPickerProps>;

export function Base(): JSX.Element {
  return (
    <ReactionPicker
      i18n={i18n}
      onPick={action('onPick')}
      onEmojiSkinToneDefaultChange={action('onEmojiSkinToneDefaultChange')}
      openCustomizePreferredReactionsModal={action(
        'openCustomizePreferredReactionsModal'
      )}
      preferredReactionEmoji={DEFAULT_PREFERRED_REACTION_EMOJI}
      renderEmojiPicker={renderEmojiPicker}
    />
  );
}

export function SelectedReaction(): JSX.Element {
  return (
    <>
      {['❤️', '👍', '👎', '😂', '😮', '😢', '😡'].map(e => (
        <div key={e} style={{ height: '100px' }}>
          <ReactionPicker
            i18n={i18n}
            selected={e}
            onPick={action('onPick')}
            onEmojiSkinToneDefaultChange={action(
              'onEmojiSkinToneDefaultChange'
            )}
            openCustomizePreferredReactionsModal={action(
              'openCustomizePreferredReactionsModal'
            )}
            preferredReactionEmoji={DEFAULT_PREFERRED_REACTION_EMOJI}
            renderEmojiPicker={renderEmojiPicker}
          />
        </div>
      ))}
    </>
  );
}
