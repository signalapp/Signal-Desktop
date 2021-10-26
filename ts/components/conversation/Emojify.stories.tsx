// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import type { Props } from './Emojify';
import { Emojify } from './Emojify';

const story = storiesOf('Components/Conversation/Emojify', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonEmoji: overrideProps.renderNonEmoji,
  sizeClass: overrideProps.sizeClass,
  text: text('text', overrideProps.text || ''),
});

story.add('Emoji Only', () => {
  const props = createProps({
    text: '😹😹😹',
  });

  return <Emojify {...props} />;
});

story.add('Skin Color Modifier', () => {
  const props = createProps({
    text: '👍🏾',
  });

  return <Emojify {...props} />;
});

story.add('Jumbo', () => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'max',
  });

  return <Emojify {...props} />;
});

story.add('Extra Large', () => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'extra-large',
  });

  return <Emojify {...props} />;
});

story.add('Large', () => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'large',
  });

  return <Emojify {...props} />;
});

story.add('Medium', () => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'medium',
  });

  return <Emojify {...props} />;
});

story.add('Small', () => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'small',
  });

  return <Emojify {...props} />;
});

story.add('Plus Text', () => {
  const props = createProps({
    text: 'this 😹 cat 😹 is 😹 so 😹 joyful',
  });

  return <Emojify {...props} />;
});

story.add('All Text, No Emoji', () => {
  const props = createProps({
    text: 'this cat is so joyful',
  });

  return <Emojify {...props} />;
});

story.add('Custom Text Render', () => {
  const props = createProps({
    text: 'this 😹 cat 😹 is 😹 so 😹 joyful',
    renderNonEmoji: ({ text: theText, key }) => (
      <div key={key} style={{ backgroundColor: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <Emojify {...props} />;
});

story.add('Tens of thousands of emoji', () => {
  const props = createProps({
    text: '💅'.repeat(40000),
  });

  return <Emojify {...props} />;
});

story.add('Tens of thousands of emoji, interspersed with text', () => {
  const props = createProps({
    text: '💅 hi '.repeat(40000),
  });

  return <Emojify {...props} />;
});
