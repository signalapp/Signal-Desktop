// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { select, text } from '@storybook/addon-knobs';
import type { Props } from './Emoji';
import { Emoji, EmojiSizes } from './Emoji';

export default {
  title: 'Components/Emoji/Emoji',
};

const tones = [0, 1, 2, 3, 4, 5];

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  size: select(
    'size',
    EmojiSizes.reduce((m, t) => ({ ...m, [t]: t }), {}),
    overrideProps.size || 48
  ),
  emoji: text('emoji', overrideProps.emoji || ''),
  shortName: text('shortName', overrideProps.shortName || ''),
  skinTone: select(
    'skinTone',
    tones.reduce((m, t) => ({ ...m, [t]: t }), {}),
    overrideProps.skinTone || 0
  ),
});

export const Sizes = (): JSX.Element => {
  const props = createProps({
    shortName: 'grinning_face_with_star_eyes',
  });

  return (
    <>
      {EmojiSizes.map(size => (
        <Emoji key={size} {...props} size={size} />
      ))}
    </>
  );
};

export const SkinTones = (): JSX.Element => {
  const props = createProps({
    shortName: 'raised_back_of_hand',
  });

  return (
    <>
      {tones.map(skinTone => (
        <Emoji key={skinTone} {...props} skinTone={skinTone} />
      ))}
    </>
  );
};

export const FromEmoji = (): JSX.Element => {
  const props = createProps({
    emoji: '😂',
  });

  return <Emoji {...props} />;
};
