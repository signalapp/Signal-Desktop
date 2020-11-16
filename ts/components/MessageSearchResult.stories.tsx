// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, text, withKnobs } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { MessageSearchResult, PropsType } from './MessageSearchResult';

const i18n = setupI18n('en', enMessages);
const story = storiesOf('Components/MessageSearchResult', module);

// Storybook types are incorrect
// eslint-disable-next-line @typescript-eslint/no-explicit-any
story.addDecorator((withKnobs as any)({ escapeHTML: false }));

const someone = {
  title: 'Some Person',
  name: 'Some Person',
  phoneNumber: '(202) 555-0011',
};

const me = {
  title: 'Me',
  name: 'Me',
  isMe: true,
};

const group = {
  title: 'Group Chat',
  name: 'Group Chat',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  id: '',
  conversationId: '',
  sentAt: Date.now() - 24 * 60 * 1000,
  snippet: text(
    'snippet',
    overrideProps.snippet || "What's <<left>>going<<right>> on?"
  ),
  from: overrideProps.from as PropsType['from'],
  to: overrideProps.to as PropsType['to'],
  isSelected: boolean('isSelected', overrideProps.isSelected || false),
  openConversationInternal: action('openConversationInternal'),
  isSearchingInConversation: boolean(
    'isSearchingInConversation',
    overrideProps.isSearchingInConversation || false
  ),
});

story.add('Default', () => {
  const props = createProps({
    from: someone,
    to: me,
  });

  return <MessageSearchResult {...props} />;
});

story.add('Selected', () => {
  const props = createProps({
    from: someone,
    to: me,
    isSelected: true,
  });

  return <MessageSearchResult {...props} />;
});

story.add('From You', () => {
  const props = createProps({
    from: me,
    to: someone,
  });

  return <MessageSearchResult {...props} />;
});

story.add('Searching in Conversation', () => {
  const props = createProps({
    from: me,
    to: someone,
    isSearchingInConversation: true,
  });

  return <MessageSearchResult {...props} />;
});

story.add('From You to Yourself', () => {
  const props = createProps({
    from: me,
    to: me,
  });

  return <MessageSearchResult {...props} />;
});

story.add('From You to Group', () => {
  const props = createProps({
    from: me,
    to: group,
  });

  return <MessageSearchResult {...props} />;
});

story.add('From Someone to Group', () => {
  const props = createProps({
    from: someone,
    to: group,
  });

  return <MessageSearchResult {...props} />;
});

story.add('Long Search Result', () => {
  const snippets = [
    'This is a really <<left>>detail<<right>>ed long line which will wrap and only be cut off after it gets to three lines. So maybe this will make it in as well?',
    "Okay, here are the <<left>>detail<<right>>s:\n\n1355 Ridge Way\nCode: 234\n\nI'm excited!",
  ];

  return snippets.map(snippet => {
    const props = createProps({
      from: someone,
      to: me,
      snippet,
    });

    return <MessageSearchResult key={snippet.length} {...props} />;
  });
});

story.add('Empty', () => {
  const props = createProps();

  return <MessageSearchResult {...props} />;
});
