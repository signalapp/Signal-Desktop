// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { boolean, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { MessageBody, Props } from './MessageBody';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/MessageBody', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  bodyRanges: overrideProps.bodyRanges,
  disableJumbomoji: boolean(
    'disableJumbomoji',
    overrideProps.disableJumbomoji || false
  ),
  disableLinks: boolean('disableLinks', overrideProps.disableLinks || false),
  direction: 'incoming',
  i18n,
  text: text('text', overrideProps.text || ''),
  textPending: boolean('textPending', overrideProps.textPending || false),
});

story.add('Links Enabled', () => {
  const props = createProps({
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
});

story.add('Links Disabled', () => {
  const props = createProps({
    disableLinks: true,
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
});

story.add('Emoji Size Based On Count', () => {
  const props = createProps();

  return (
    <>
      <MessageBody {...props} text="😹" />
      <br />
      <MessageBody {...props} text="😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹😹😹😹😹" />
    </>
  );
});

story.add('Jumbomoji Enabled', () => {
  const props = createProps({
    text: '😹',
  });

  return <MessageBody {...props} />;
});

story.add('Jumbomoji Disabled', () => {
  const props = createProps({
    disableJumbomoji: true,
    text: '😹',
  });

  return <MessageBody {...props} />;
});

story.add('Jumbomoji Disabled by Text', () => {
  const props = createProps({
    text: 'not a jumbo kitty 😹',
  });

  return <MessageBody {...props} />;
});

story.add('Text Pending', () => {
  const props = createProps({
    text: 'Check out https://www.signal.org',
    textPending: true,
  });

  return <MessageBody {...props} />;
});

story.add('@Mention', () => {
  const props = createProps({
    bodyRanges: [
      {
        start: 5,
        length: 1,
        mentionUuid: 'tuv',
        replacementText: 'Bender B Rodriguez 🤖',
      },
    ],
    text:
      'Like \uFFFC once said: My story is a lot like yours, only more interesting because it involves robots',
  });

  return <MessageBody {...props} />;
});

story.add('Multiple @Mentions', () => {
  const props = createProps({
    // These are intentionally in a mixed order to test how we deal with that
    bodyRanges: [
      {
        start: 2,
        length: 1,
        mentionUuid: 'def',
        replacementText: 'Philip J Fry',
      },
      {
        start: 4,
        length: 1,
        mentionUuid: 'abc',
        replacementText: 'Professor Farnsworth',
      },
      {
        start: 0,
        length: 1,
        mentionUuid: 'xyz',
        replacementText: 'Yancy Fry',
      },
    ],
    text: '\uFFFC \uFFFC \uFFFC',
  });

  return <MessageBody {...props} />;
});

story.add('Complex MessageBody', () => {
  const props = createProps({
    bodyRanges: [
      // These are intentionally in a mixed order to test how we deal with that
      {
        start: 78,
        length: 1,
        mentionUuid: 'wer',
        replacementText: 'Acid Burn',
      },
      {
        start: 80,
        length: 1,
        mentionUuid: 'xox',
        replacementText: 'Cereal Killer',
      },
      {
        start: 4,
        length: 1,
        mentionUuid: 'ldo',
        replacementText: 'Zero Cool',
      },
    ],
    direction: 'outgoing',
    text:
      'Hey \uFFFC\nCheck out https://www.signal.org I think you will really like it 😍\n\ncc \uFFFC \uFFFC',
  });

  return <MessageBody {...props} />;
});
