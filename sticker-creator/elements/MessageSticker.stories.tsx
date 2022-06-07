// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { number, text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { MessageSticker } from './MessageSticker';

export default {
  title: 'Sticker Creator/elements',
};

export const _MessageSticker = (): JSX.Element => {
  const image = text('image url', '/fixtures/512x515-thumbs-up-lincoln.webp');
  const minutesAgo = number('minutesAgo', 3);

  return (
    <StoryRow>
      <MessageSticker image={image} minutesAgo={minutesAgo} />
    </StoryRow>
  );
};

_MessageSticker.story = {
  name: 'MessageSticker',
};
