// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props as ReactionPickerProps } from './ReactionPicker.dom.tsx';
import { ReactionPicker } from './ReactionPicker.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ReactionPicker',
} satisfies Meta<ReactionPickerProps>;

export function Base(): JSX.Element {
  return (
    <ReactionPicker
      i18n={i18n}
      onPick={action('onPick')}
      preferredReactionEmoji={Emoji.getDefaultPreferredReactionEmojis(
        Emoji.SkinTone.None
      )}
    />
  );
}

export function SelectedReaction(): JSX.Element {
  return (
    <>
      {[
        Emoji.HEART,
        Emoji.getDefaultVariant(Emoji.THUMBS_UP),
        Emoji.getDefaultVariant(Emoji.THUMBS_DOWN),
        Emoji.JOY,
        Emoji.OPEN_MOUTH,
        Emoji.CRY,
        Emoji.RAGE,
      ].map(e => (
        <div key={e} style={{ height: '100px' }}>
          <ReactionPicker
            i18n={i18n}
            selected={e}
            onPick={action('onPick')}
            preferredReactionEmoji={Emoji.getDefaultPreferredReactionEmojis(
              Emoji.SkinTone.None
            )}
          />
        </div>
      ))}
    </>
  );
}
