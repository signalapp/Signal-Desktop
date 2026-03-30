// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props as ReactionPickerProps } from './ReactionPicker.dom.tsx';
import { ReactionPicker } from './ReactionPicker.dom.tsx';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../../reactions/constants.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ReactionPicker',
} satisfies Meta<ReactionPickerProps>;

export function Base(): React.JSX.Element {
  return (
    <ReactionPicker
      i18n={i18n}
      onPick={action('onPick')}
      preferredReactionEmoji={DEFAULT_PREFERRED_REACTION_EMOJI}
    />
  );
}

export function SelectedReaction(): React.JSX.Element {
  return (
    <>
      {['❤️', '👍', '👎', '😂', '😮', '😢', '😡'].map(e => (
        <div key={e} style={{ height: '100px' }}>
          <ReactionPicker
            i18n={i18n}
            selected={e}
            onPick={action('onPick')}
            preferredReactionEmoji={DEFAULT_PREFERRED_REACTION_EMOJI}
          />
        </div>
      ))}
    </>
  );
}
