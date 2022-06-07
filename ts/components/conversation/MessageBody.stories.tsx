// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { boolean, text } from '@storybook/addon-knobs';

import type { Props } from './MessageBody';
import { MessageBody } from './MessageBody';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MessageBody',
};

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
  textAttachment: overrideProps.textAttachment || {
    pending: boolean('textPending', false),
  },
});

export const LinksEnabled = (): JSX.Element => {
  const props = createProps({
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
};

export const LinksDisabled = (): JSX.Element => {
  const props = createProps({
    disableLinks: true,
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
};

export const EmojiSizeBasedOnCount = (): JSX.Element => {
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
};

export const JumbomojiEnabled = (): JSX.Element => {
  const props = createProps({
    text: '😹',
  });

  return <MessageBody {...props} />;
};

export const JumbomojiDisabled = (): JSX.Element => {
  const props = createProps({
    disableJumbomoji: true,
    text: '😹',
  });

  return <MessageBody {...props} />;
};

export const JumbomojiDisabledByText = (): JSX.Element => {
  const props = createProps({
    text: 'not a jumbo kitty 😹',
  });

  return <MessageBody {...props} />;
};

JumbomojiDisabledByText.story = {
  name: 'Jumbomoji Disabled by Text',
};

export const TextPending = (): JSX.Element => {
  const props = createProps({
    text: 'Check out https://www.signal.org',
    textAttachment: {
      pending: true,
    },
  });

  return <MessageBody {...props} />;
};

export const Mention = (): JSX.Element => {
  const props = createProps({
    bodyRanges: [
      {
        start: 5,
        length: 1,
        mentionUuid: 'tuv',
        replacementText: 'Bender B Rodriguez 🤖',
      },
    ],
    text: 'Like \uFFFC once said: My story is a lot like yours, only more interesting because it involves robots',
  });

  return <MessageBody {...props} />;
};

Mention.story = {
  name: '@Mention',
};

export const MultipleMentions = (): JSX.Element => {
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
};

MultipleMentions.story = {
  name: 'Multiple @Mentions',
};

export const ComplexMessageBody = (): JSX.Element => {
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
    text: 'Hey \uFFFC\nCheck out https://www.signal.org I think you will really like it 😍\n\ncc \uFFFC \uFFFC',
  });

  return <MessageBody {...props} />;
};

ComplexMessageBody.story = {
  name: 'Complex MessageBody',
};
