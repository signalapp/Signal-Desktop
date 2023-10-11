// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './Emoji';
import { Emoji, EmojiSizes } from './Emoji';

const tones = [0, 1, 2, 3, 4, 5];

export default {
  title: 'Components/Emoji/Emoji',
  argTypes: {
    size: { control: { type: 'select' }, options: EmojiSizes },
    emoji: { control: { type: 'text' } },
    shortName: { control: { type: 'text' } },
    skinTone: { control: { type: 'select' }, options: tones },
  },
  args: {
    size: 48,
    emoji: '',
    shortName: '',
    skinTone: 0,
  },
} satisfies Meta<Props>;

export function Sizes(args: Props): JSX.Element {
  return (
    <>
      {EmojiSizes.map(size => (
        <Emoji
          key={size}
          {...args}
          shortName="grinning_face_with_star_eyes"
          size={size}
        />
      ))}
    </>
  );
}

export function SkinTones(args: Props): JSX.Element {
  return (
    <>
      {tones.map(skinTone => (
        <Emoji
          key={skinTone}
          {...args}
          shortName="raised_back_of_hand"
          skinTone={skinTone}
        />
      ))}
    </>
  );
}

export function FromEmoji(args: Props): JSX.Element {
  return <Emoji {...args} emoji="😂" />;
}
