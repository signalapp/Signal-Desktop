// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { text } from '@storybook/addon-knobs';

import type { Props } from './Emojify';
import { Emojify } from './Emojify';

export default {
  title: 'Components/Conversation/Emojify',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonEmoji: overrideProps.renderNonEmoji,
  sizeClass: overrideProps.sizeClass,
  text: text('text', overrideProps.text || ''),
});

export const EmojiOnly = (): JSX.Element => {
  const props = createProps({
    text: '😹😹😹',
  });

  return <Emojify {...props} />;
};

export const SkinColorModifier = (): JSX.Element => {
  const props = createProps({
    text: '👍🏾',
  });

  return <Emojify {...props} />;
};

export const Jumbo = (): JSX.Element => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'max',
  });

  return <Emojify {...props} />;
};

export const ExtraLarge = (): JSX.Element => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'extra-large',
  });

  return <Emojify {...props} />;
};

export const Large = (): JSX.Element => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'large',
  });

  return <Emojify {...props} />;
};

export const Medium = (): JSX.Element => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'medium',
  });

  return <Emojify {...props} />;
};

export const Small = (): JSX.Element => {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'small',
  });

  return <Emojify {...props} />;
};

export const PlusText = (): JSX.Element => {
  const props = createProps({
    text: 'this 😹 cat 😹 is 😹 so 😹 joyful',
  });

  return <Emojify {...props} />;
};

export const AllTextNoEmoji = (): JSX.Element => {
  const props = createProps({
    text: 'this cat is so joyful',
  });

  return <Emojify {...props} />;
};

AllTextNoEmoji.story = {
  name: 'All Text, No Emoji',
};

export const CustomTextRender = (): JSX.Element => {
  const props = createProps({
    text: 'this 😹 cat 😹 is 😹 so 😹 joyful',
    renderNonEmoji: ({ text: theText, key }) => (
      <div key={key} style={{ backgroundColor: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <Emojify {...props} />;
};

export const TensOfThousandsOfEmoji = (): JSX.Element => {
  const props = createProps({
    text: '💅'.repeat(40000),
  });

  return <Emojify {...props} />;
};

TensOfThousandsOfEmoji.story = {
  name: 'Tens of thousands of emoji',
};

export const TensOfThousandsOfEmojiInterspersedWithText = (): JSX.Element => {
  const props = createProps({
    text: '💅 hi '.repeat(40000),
  });

  return <Emojify {...props} />;
};

TensOfThousandsOfEmojiInterspersedWithText.story = {
  name: 'Tens of thousands of emoji, interspersed with text',
};
