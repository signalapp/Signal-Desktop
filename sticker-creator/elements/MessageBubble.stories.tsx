// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { number, text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { MessageBubble } from './MessageBubble';

export default {
  title: 'Sticker Creator/elements',
};

export const _MessageBubble = (): JSX.Element => {
  const child = text('text', 'Foo bar banana baz');
  const minutesAgo = number('minutesAgo', 3);

  return (
    <StoryRow>
      <MessageBubble minutesAgo={minutesAgo}>{child}</MessageBubble>
    </StoryRow>
  );
};

_MessageBubble.story = {
  name: 'MessageBubble',
};
