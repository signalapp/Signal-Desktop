// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './Emojify.dom.js';
import { Emojify } from './Emojify.dom.js';

export default {
  title: 'Components/Conversation/Emojify',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonEmoji: overrideProps.renderNonEmoji,
  fontSizeOverride: overrideProps.fontSizeOverride,
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
    fontSizeOverride: 56,
  });

  return <Emojify {...props} />;
}

export function ExtraLarge(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    fontSizeOverride: 48,
  });

  return <Emojify {...props} />;
}

export function Large(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    fontSizeOverride: 40,
  });

  return <Emojify {...props} />;
}

export function Medium(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    fontSizeOverride: 36,
  });

  return <Emojify {...props} />;
}

export function Small(): JSX.Element {
  const props = createProps({
    text: '😹😹😹',
    fontSizeOverride: 32,
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

export function NonQualifiedEmoji(): JSX.Element {
  const props = createProps({
    text: '\u{00AE}',
  });

  return <Emojify {...props} />;
}

export function OverlyQualifiedEmoji(): JSX.Element {
  const props = createProps({
    text: '\u{26AA}\u{FE0F}',
  });

  return <Emojify {...props} />;
}
