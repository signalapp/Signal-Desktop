// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { text } from '@storybook/addon-knobs';

import type { Props } from './Linkify';
import { Linkify } from './Linkify';

export default {
  title: 'Components/Conversation/Linkify',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonLink: overrideProps.renderNonLink,
  text: text('text', overrideProps.text || ''),
});

export const OnlyLink = (): JSX.Element => {
  const props = createProps({
    text: 'https://www.signal.org',
  });

  return <Linkify {...props} />;
};

export const LinksWithText = (): JSX.Element => {
  const props = createProps({
    text: 'you should see this: https://www.signal.org - it is good. Also: https://placekitten.com!',
  });

  return <Linkify {...props} />;
};

LinksWithText.story = {
  name: 'Links with Text',
};

export const LinksWithEmojiWithoutSpace = (): JSX.Element => {
  const props = createProps({
    text: '👍https://www.signal.org😎',
  });

  return <Linkify {...props} />;
};

LinksWithEmojiWithoutSpace.story = {
  name: 'Links with Emoji without space',
};

export const LinksWithEmojiAndText = (): JSX.Element => {
  const props = createProps({
    text: 'https://example.com ⚠️ 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ https://example.com',
  });

  return <Linkify {...props} />;
};

LinksWithEmojiAndText.story = {
  name: 'Links with Emoji and Text',
};

export const NoLink = (): JSX.Element => {
  const props = createProps({
    text: 'I am fond of cats',
  });

  return <Linkify {...props} />;
};

export const BlockedProtocols = (): JSX.Element => {
  const props = createProps({
    text: 'smailto:someone@somewhere.com - ftp://something.com - //local/share - \\localshare',
  });

  return <Linkify {...props} />;
};

export const MissingProtocols = (): JSX.Element => {
  const props = createProps({
    text: 'I love example.com. I also love кц.рф. I also love مثال.تونس. But I do not love test.example.',
  });

  return <Linkify {...props} />;
};

MissingProtocols.story = {
  name: 'Missing protocols',
};

export const CustomTextRender = (): JSX.Element => {
  const props = createProps({
    text: 'you should see this: https://www.signal.org - it is good. Also: https://placekitten.com!',
    renderNonLink: ({ text: theText, key }) => (
      <div key={key} style={{ backgroundColor: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <Linkify {...props} />;
};
