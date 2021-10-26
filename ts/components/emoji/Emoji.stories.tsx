// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { select, text } from '@storybook/addon-knobs';
import type { Props } from './Emoji';
import { Emoji, EmojiSizes } from './Emoji';

const story = storiesOf('Components/Emoji/Emoji', module);

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

story.add('Sizes', () => {
  const props = createProps({
    shortName: 'grinning_face_with_star_eyes',
  });

  return EmojiSizes.map(size => <Emoji key={size} {...props} size={size} />);
});

story.add('Skin Tones', () => {
  const props = createProps({
    shortName: 'raised_back_of_hand',
  });

  return tones.map(skinTone => (
    <Emoji key={skinTone} {...props} skinTone={skinTone} />
  ));
});

story.add('From Emoji', () => {
  const props = createProps({
    emoji: '😂',
  });

  return <Emoji {...props} />;
});
