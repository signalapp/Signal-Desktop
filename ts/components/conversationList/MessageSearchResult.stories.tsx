// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, text, withKnobs } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
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
  body: text('body', overrideProps.body || "What's going on?"),
  bodyRanges: overrideProps.bodyRanges || [],
  from: overrideProps.from as PropsType['from'],
  to: overrideProps.to as PropsType['to'],
  isSelected: boolean('isSelected', overrideProps.isSelected || false),
  openConversationInternal: action('openConversationInternal'),
  isSearchingInConversation: boolean(
    'isSearchingInConversation',
    overrideProps.isSearchingInConversation || false
  ),
  style: {},
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

story.add('Empty (should be invalid)', () => {
  const props = createProps();

  return <MessageSearchResult {...props} />;
});

story.add('@mention', () => {
  const props = createProps({
    body:
      'moss banana twine sound lake zoo brain count vacuum work stairs try power forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia bayonet vector orange forge diary zebra turtle rise front \uFFFC',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 113,
      },
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 237,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '...forget hair dry diary years no <<left>>results<<right>> \uFFFC <<left>>elephant<<right>> sorry umbrella potato igloo kangaroo home Georgia...',
  });

  return <MessageSearchResult {...props} />;
});

story.add('@mention regexp', () => {
  const props = createProps({
    body:
      '\uFFFC This is a (long) /text/ ^$ that is ... specially **crafted** to (test) our regexp escaping mechanism! Making sure that the code we write works in all sorts of scenarios',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'RegExp',
        start: 0,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '\uFFFC This is a (long) /text/ ^$ that is ... <<left>>specially<<right>> **crafted** to (test) our regexp escaping mechanism...',
  });

  return <MessageSearchResult {...props} />;
});

story.add('@mention no-matches', () => {
  const props = createProps({
    body: '\uFFFC hello',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Neo',
        start: 0,
      },
    ],
    from: someone,
    to: me,
    snippet: '\uFFFC hello',
  });

  return <MessageSearchResult {...props} />;
});

story.add('@mention no-matches', () => {
  const props = createProps({
    body:
      'moss banana twine sound lake zoo brain count vacuum work stairs try power forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia bayonet vector orange forge diary zebra turtle rise front \uFFFC',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 113,
      },
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 237,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '...forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia...',
  });

  return <MessageSearchResult {...props} />;
});

story.add('Double @mention', () => {
  const props = createProps({
    body: 'Hey \uFFFC \uFFFC test',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '9eb2eb65-992a-4909-a2a5-18c56bd7648f',
        replacementText: 'Alice',
        start: 4,
      },
      {
        length: 1,
        mentionUuid: '755ec61b-1590-48da-b003-3e57b2b54448',
        replacementText: 'Bob',
        start: 6,
      },
    ],
    from: someone,
    to: me,
    snippet: '<<left>>Hey<<right>> \uFFFC \uFFFC <<left>>test<<right>>',
  });

  return <MessageSearchResult {...props} />;
});
