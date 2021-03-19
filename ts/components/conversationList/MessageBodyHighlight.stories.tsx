// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text, withKnobs } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { MessageBodyHighlight, Props } from './MessageBodyHighlight';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/MessageBodyHighlight', module);

// Storybook types are incorrect
// eslint-disable-next-line @typescript-eslint/no-explicit-any
story.addDecorator((withKnobs as any)({ escapeHTML: false }));

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  bodyRanges: overrideProps.bodyRanges || [],
  i18n,
  text: text('text', overrideProps.text || ''),
});

story.add('Basic', () => {
  const props = createProps({
    text: 'This is before <<left>>Inside<<right>> This is after.',
  });

  return <MessageBodyHighlight {...props} />;
});

story.add('No Replacement', () => {
  const props = createProps({
    text: 'All\nplain\ntext 🔥 http://somewhere.com',
  });

  return <MessageBodyHighlight {...props} />;
});

story.add('Two Replacements', () => {
  const props = createProps({
    text:
      'Begin <<left>>Inside #1<<right>> This is between the two <<left>>Inside #2<<right>> End.',
  });

  return <MessageBodyHighlight {...props} />;
});

story.add('Two Replacements with an @mention', () => {
  const props = createProps({
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '0ca40892-7b1a-11eb-9439-0242ac130002',
        replacementText: 'Jin Sakai',
        start: 33,
      },
    ],
    text:
      'Begin <<left>>Inside #1<<right>> \uFFFC This is between the two <<left>>Inside #2<<right>> End.',
  });

  return <MessageBodyHighlight {...props} />;
});

story.add('Emoji + Newlines + URLs', () => {
  const props = createProps({
    text:
      '\nhttp://somewhere.com\n\n🔥 Before -- <<left>>A 🔥 inside<<right>> -- After 🔥',
  });

  return <MessageBodyHighlight {...props} />;
});

story.add('No Jumbomoji', () => {
  const props = createProps({
    text: '🔥',
  });

  return <MessageBodyHighlight {...props} />;
});
