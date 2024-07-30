// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props as ReactionPickerProps } from './ReactionPicker';
import { ReactionPicker } from './ReactionPicker';
import { EmojiPicker } from '../emoji/EmojiPicker';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../../reactions/constants';

const i18n = setupI18n('en', enMessages);

const renderEmojiPicker: ReactionPickerProps['renderEmojiPicker'] = ({
  onClose,
  onPickEmoji,
  onSetSkinTone,
  ref,
}) => (
  <EmojiPicker
    i18n={i18n}
    skinTone={0}
    ref={ref}
    onClose={onClose}
    onPickEmoji={onPickEmoji}
    onSetSkinTone={onSetSkinTone}
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
      onSetSkinTone={action('onSetSkinTone')}
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
            onSetSkinTone={action('onSetSkinTone')}
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
