// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { Linkify, Props } from './Linkify';

const story = storiesOf('Components/Conversation/Linkify', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonLink: overrideProps.renderNonLink,
  text: text('text', overrideProps.text || ''),
});

story.add('Only Link', () => {
  const props = createProps({
    text: 'https://www.signal.org',
  });

  return <Linkify {...props} />;
});

story.add('Links with Text', () => {
  const props = createProps({
    text:
      'you should see this: https://www.signal.org - it is good. Also: https://placekitten.com!',
  });

  return <Linkify {...props} />;
});

story.add('Links with Emoji without space', () => {
  const props = createProps({
    text: '👍https://www.signal.org😎',
  });

  return <Linkify {...props} />;
});

story.add('No Link', () => {
  const props = createProps({
    text: 'I am fond of cats',
  });

  return <Linkify {...props} />;
});

story.add('Blocked Protocols', () => {
  const props = createProps({
    text:
      'smailto:someone@somewhere.com - ftp://something.com - //local/share - \\localshare',
  });

  return <Linkify {...props} />;
});

story.add('Missing Protocol', () => {
  const props = createProps({
    text: 'github.com is a place for things',
  });

  return <Linkify {...props} />;
});

story.add('non-ASCII TLD', () => {
  const props = createProps({
    // Domain of "Coordination Center for TLD RU".
    text: 'кц.рф has no ASCII characters',
  });

  return <Linkify {...props} />;
});

story.add('Right-to-left TLD', () => {
  const props = createProps({
    text:
      // Domain of "Ministry of equipment, housing and infrastructure" of tunisia.
      //   "I am slightly confused how RTL text works, but here is a domain:"
      'أنا مرتبك قليلاً حول كيفية عمل النص من اليمين إلى اليسار ، ولكن هنا مجال: تجهيز.تونس',
  });

  return <Linkify {...props} />;
});

story.add('Right-to-left TLD mixed with Left-to-right text', () => {
  const props = createProps({
    text:
      // Domain of "Ministry of equipment, housing and infrastructure" of tunisia.
      'I am slightly confused how Right-to-left text works, but here is a domain: تجهيز.تونس',
  });

  return <Linkify {...props} />;
});

story.add('Custom Text Render', () => {
  const props = createProps({
    text:
      'you should see this: https://www.signal.org - it is good. Also: https://placekitten.com!',
    renderNonLink: ({ text: theText, key }) => (
      <div key={key} style={{ backgroundColor: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <Linkify {...props} />;
});
