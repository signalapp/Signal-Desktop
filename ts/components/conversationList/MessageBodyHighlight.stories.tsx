// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './MessageBodyHighlight';
import { MessageBodyHighlight } from './MessageBodyHighlight';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MessageBodyHighlight',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  bodyRanges: overrideProps.bodyRanges || [],
  i18n,
  text: text('text', overrideProps.text || ''),
});

export const Basic = (): JSX.Element => {
  const props = createProps({
    text: 'This is before <<left>>Inside<<right>> This is after.',
  });

  return <MessageBodyHighlight {...props} />;
};

export const NoReplacement = (): JSX.Element => {
  const props = createProps({
    text: 'All\nplain\ntext 🔥 http://somewhere.com',
  });

  return <MessageBodyHighlight {...props} />;
};

export const TwoReplacements = (): JSX.Element => {
  const props = createProps({
    text: 'Begin <<left>>Inside #1<<right>> This is between the two <<left>>Inside #2<<right>> End.',
  });

  return <MessageBodyHighlight {...props} />;
};

export const TwoReplacementsWithAnMention = (): JSX.Element => {
  const props = createProps({
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '0ca40892-7b1a-11eb-9439-0242ac130002',
        replacementText: 'Jin Sakai',
        start: 33,
      },
    ],
    text: 'Begin <<left>>Inside #1<<right>> \uFFFC This is between the two <<left>>Inside #2<<right>> End.',
  });

  return <MessageBodyHighlight {...props} />;
};

TwoReplacementsWithAnMention.story = {
  name: 'Two Replacements with an @mention',
};

export const EmojiNewlinesUrLs = (): JSX.Element => {
  const props = createProps({
    text: '\nhttp://somewhere.com\n\n🔥 Before -- <<left>>A 🔥 inside<<right>> -- After 🔥',
  });

  return <MessageBodyHighlight {...props} />;
};

EmojiNewlinesUrLs.story = {
  name: 'Emoji + Newlines + URLs',
};

export const NoJumbomoji = (): JSX.Element => {
  const props = createProps({
    text: '🔥',
  });

  return <MessageBodyHighlight {...props} />;
};
