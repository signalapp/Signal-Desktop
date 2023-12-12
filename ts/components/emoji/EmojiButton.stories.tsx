// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './EmojiButton';
import { EmojiButton } from './EmojiButton';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Emoji/EmojiButton',
} satisfies Meta<Props>;

export function Base(): JSX.Element {
  return (
    <div
      style={{
        height: '500px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <EmojiButton
        i18n={i18n}
        onPickEmoji={action('onPickEmoji')}
        skinTone={0}
        onSetSkinTone={action('onSetSkinTone')}
        recentEmojis={[
          'grinning',
          'grin',
          'joy',
          'rolling_on_the_floor_laughing',
          'smiley',
          'smile',
          'sweat_smile',
          'laughing',
          'wink',
          'blush',
          'yum',
          'sunglasses',
          'heart_eyes',
          'kissing_heart',
          'kissing',
          'kissing_smiling_eyes',
          'kissing_closed_eyes',
          'relaxed',
          'slightly_smiling_face',
          'hugging_face',
          'grinning_face_with_star_eyes',
          'thinking_face',
          'face_with_one_eyebrow_raised',
          'neutral_face',
          'expressionless',
          'no_mouth',
          'face_with_rolling_eyes',
          'smirk',
          'persevere',
          'disappointed_relieved',
          'open_mouth',
          'zipper_mouth_face',
        ]}
      />
    </div>
  );
}
