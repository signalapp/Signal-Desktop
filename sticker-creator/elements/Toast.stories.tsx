// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { StoryRow } from './StoryRow';
import { Toast } from './Toast';

storiesOf('Sticker Creator/elements', module).add('Toast', () => {
  const child = text('text', 'foo bar');

  return (
    <StoryRow>
      <Toast onClick={action('click')}>{child}</Toast>
    </StoryRow>
  );
});
