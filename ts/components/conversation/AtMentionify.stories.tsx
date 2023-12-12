// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { generateAci } from '../../types/ServiceId';
import type { Props } from './AtMentionify';
import { AtMentionify } from './AtMentionify';

const SERVICE_ID_1 = generateAci();
const SERVICE_ID_2 = generateAci();
const SERVICE_ID_3 = generateAci();
const SERVICE_ID_4 = generateAci();
const SERVICE_ID_5 = generateAci();
const SERVICE_ID_6 = generateAci();

export default {
  title: 'Components/Conversation/AtMentionify',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  mentions: overrideProps.mentions,
  direction: overrideProps.direction || 'incoming',
  showConversation: action('showConversation'),
  text: overrideProps.text || '',
});

export function NoMentions(): JSX.Element {
  const props = createProps({
    text: 'Hello World',
  });

  return <AtMentionify {...props} />;
}

export function MultipleMentions(): JSX.Element {
  const mentions = [
    {
      start: 4,
      length: 1,
      mentionAci: SERVICE_ID_1,
      replacementText: 'Professor Farnsworth',
      conversationID: 'x',
    },
    {
      start: 2,
      length: 1,
      mentionAci: SERVICE_ID_2,
      replacementText: 'Philip J Fry',
      conversationID: 'x',
    },
    {
      start: 0,
      length: 1,
      mentionAci: SERVICE_ID_3,
      replacementText: 'Yancy Fry',
      conversationID: 'x',
    },
  ];
  const props = createProps({
    mentions,
    direction: 'outgoing',
    text: AtMentionify.preprocessMentions('\uFFFC \uFFFC \uFFFC', mentions),
  });

  return <AtMentionify {...props} />;
}

export function ComplexMentions(): JSX.Element {
  const mentions = [
    {
      start: 80,
      length: 1,
      mentionAci: SERVICE_ID_4,
      replacementText: 'Cereal Killer',
      conversationID: 'x',
    },
    {
      start: 78,
      length: 1,
      mentionAci: SERVICE_ID_5,
      replacementText: 'Acid Burn',
      conversationID: 'x',
    },
    {
      start: 4,
      length: 1,
      mentionAci: SERVICE_ID_6,
      replacementText: 'Zero Cool',
      conversationID: 'x',
    },
  ];

  const props = createProps({
    mentions,
    text: AtMentionify.preprocessMentions(
      'Hey \uFFFC\nCheck out https://www.signal.org I think you will really like it 😍\n\ncc \uFFFC \uFFFC',
      mentions
    ),
  });

  return <AtMentionify {...props} />;
}

export function WithOddCharacter(): JSX.Element {
  const mentions = [
    {
      start: 4,
      length: 1,
      mentionAci: SERVICE_ID_6,
      replacementText: 'Zero Cool',
      conversationID: 'x',
    },
  ];

  const props = createProps({
    mentions,
    text: AtMentionify.preprocessMentions(
      'Hey \uFFFC - Check out │https://www.signal.org│',
      mentions
    ),
  });

  return <AtMentionify {...props} />;
}
