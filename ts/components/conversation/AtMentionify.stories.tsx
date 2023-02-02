// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import type { Props } from './AtMentionify';
import { AtMentionify } from './AtMentionify';

export default {
  title: 'Components/Conversation/AtMentionify',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  bodyRanges: overrideProps.bodyRanges,
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
  const bodyRanges = [
    {
      start: 4,
      length: 1,
      mentionUuid: 'abc',
      replacementText: 'Professor Farnsworth',
      conversationID: 'x',
    },
    {
      start: 2,
      length: 1,
      mentionUuid: 'def',
      replacementText: 'Philip J Fry',
      conversationID: 'x',
    },
    {
      start: 0,
      length: 1,
      mentionUuid: 'xyz',
      replacementText: 'Yancy Fry',
      conversationID: 'x',
    },
  ];
  const props = createProps({
    bodyRanges,
    direction: 'outgoing',
    text: AtMentionify.preprocessMentions('\uFFFC \uFFFC \uFFFC', bodyRanges),
  });

  return <AtMentionify {...props} />;
}

export function ComplexMentions(): JSX.Element {
  const bodyRanges = [
    {
      start: 80,
      length: 1,
      mentionUuid: 'ioe',
      replacementText: 'Cereal Killer',
      conversationID: 'x',
    },
    {
      start: 78,
      length: 1,
      mentionUuid: 'fdr',
      replacementText: 'Acid Burn',
      conversationID: 'x',
    },
    {
      start: 4,
      length: 1,
      mentionUuid: 'ope',
      replacementText: 'Zero Cool',
      conversationID: 'x',
    },
  ];

  const props = createProps({
    bodyRanges,
    text: AtMentionify.preprocessMentions(
      'Hey \uFFFC\nCheck out https://www.signal.org I think you will really like it 😍\n\ncc \uFFFC \uFFFC',
      bodyRanges
    ),
  });

  return <AtMentionify {...props} />;
}

export function WithOddCharacter(): JSX.Element {
  const bodyRanges = [
    {
      start: 4,
      length: 1,
      mentionUuid: 'ope',
      replacementText: 'Zero Cool',
      conversationID: 'x',
    },
  ];

  const props = createProps({
    bodyRanges,
    text: AtMentionify.preprocessMentions(
      'Hey \uFFFC - Check out │https://www.signal.org│',
      bodyRanges
    ),
  });

  return <AtMentionify {...props} />;
}
