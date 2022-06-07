// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props as ReactionPickerProps } from './ReactionPicker';
import { ReactionPicker } from './ReactionPicker';
import { EmojiPicker } from '../emoji/EmojiPicker';

const i18n = setupI18n('en', enMessages);

const preferredReactionEmoji = ['❤️', '👍', '👎', '😂', '😮', '😢'];

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
  />
);

export default {
  title: 'Components/Conversation/ReactionPicker',
};

export const Base = (): JSX.Element => {
  return (
    <ReactionPicker
      i18n={i18n}
      onPick={action('onPick')}
      onSetSkinTone={action('onSetSkinTone')}
      openCustomizePreferredReactionsModal={action(
        'openCustomizePreferredReactionsModal'
      )}
      preferredReactionEmoji={preferredReactionEmoji}
      renderEmojiPicker={renderEmojiPicker}
    />
  );
};

export const SelectedReaction = (): JSX.Element => {
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
            preferredReactionEmoji={preferredReactionEmoji}
            renderEmojiPicker={renderEmojiPicker}
          />
        </div>
      ))}
    </>
  );
};
