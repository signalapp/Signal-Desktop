// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './Emojify';
import { Emojify } from './Emojify';

export default {
  title: 'Components/Conversation/Emojify',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonEmoji: overrideProps.renderNonEmoji,
  sizeClass: overrideProps.sizeClass,
  text: overrideProps.text || '',
});

export function EmojiOnly(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
  });

  return <Emojify {...props} />;
}

export function SkinColorModifier(): JSX.Element {
  const props = createProps({
    text: '👍🏾',
  });

  return <Emojify {...props} />;
}

export function Jumbo(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'max',
  });

  return <Emojify {...props} />;
}

export function ExtraLarge(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'extra-large',
  });

  return <Emojify {...props} />;
}

export function Large(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'large',
  });

  return <Emojify {...props} />;
}

export function Medium(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'medium',
  });

  return <Emojify {...props} />;
}

export function Small(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    sizeClass: 'small',
  });

  return <Emojify {...props} />;
}

export function PlusText(): JSX.Element {
  const props = createProps({
    text: 'this 😹 cat 😹 is 😹 so 😹 joyful',
  });

  return <Emojify {...props} />;
}

export function AllTextNoEmoji(): JSX.Element {
  const props = createProps({
    text: 'this cat is so joyful',
  });

  return <Emojify {...props} />;
}

export function CustomTextRender(): JSX.Element {
  const props = createProps({
    text: 'this 😹 cat 😹 is 😹 so 😹 joyful',
    renderNonEmoji: ({ text: theText, key }) => (
      <div key={key} style={{ backgroundColor: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <Emojify {...props} />;
}

export function TensOfThousandsOfEmoji(): JSX.Element {
  const props = createProps({
    text: '💅'.repeat(40000),
  });

  return <Emojify {...props} />;
}

export function TensOfThousandsOfEmojiInterspersedWithText(): JSX.Element {
  const props = createProps({
    text: '💅 hi '.repeat(40000),
  });

  return <Emojify {...props} />;
}
