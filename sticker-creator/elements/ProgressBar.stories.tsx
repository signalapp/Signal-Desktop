// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { number } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { ProgressBar } from './ProgressBar';

storiesOf('Sticker Creator/elements', module).add('ProgressBar', () => {
  const count = number('count', 5);
  const total = number('total', 10);

  return (
    <StoryRow>
      <ProgressBar count={count} total={total} />
    </StoryRow>
  );
});
