// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { select, text } from '@storybook/addon-knobs';

import type { Props } from './AtMentionify';
import { AtMentionify } from './AtMentionify';

export default {
  title: 'Components/Conversation/AtMentionify',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  bodyRanges: overrideProps.bodyRanges,
  direction: select(
    'direction',
    { incoming: 'incoming', outgoing: 'outgoing' },
    overrideProps.direction || 'incoming'
  ),
  openConversation: action('openConversation'),
  text: text('text', overrideProps.text || ''),
});

export const NoMentions = (): JSX.Element => {
  const props = createProps({
    text: 'Hello World',
  });

  return <AtMentionify {...props} />;
};

NoMentions.story = {
  name: 'No @mentions',
};

export const MultipleMentions = (): JSX.Element => {
  const bodyRanges = [
    {
      start: 4,
      length: 1,
      mentionUuid: 'abc',
      replacementText: 'Professor Farnsworth',
    },
    {
      start: 2,
      length: 1,
      mentionUuid: 'def',
      replacementText: 'Philip J Fry',
    },
    {
      start: 0,
      length: 1,
      mentionUuid: 'xyz',
      replacementText: 'Yancy Fry',
    },
  ];
  const props = createProps({
    bodyRanges,
    direction: 'outgoing',
    text: AtMentionify.preprocessMentions('\uFFFC \uFFFC \uFFFC', bodyRanges),
  });

  return <AtMentionify {...props} />;
};

MultipleMentions.story = {
  name: 'Multiple @Mentions',
};

export const ComplexMentions = (): JSX.Element => {
  const bodyRanges = [
    {
      start: 80,
      length: 1,
      mentionUuid: 'ioe',
      replacementText: 'Cereal Killer',
    },
    {
      start: 78,
      length: 1,
      mentionUuid: 'fdr',
      replacementText: 'Acid Burn',
    },
    {
      start: 4,
      length: 1,
      mentionUuid: 'ope',
      replacementText: 'Zero Cool',
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
};

ComplexMentions.story = {
  name: 'Complex @mentions',
};
