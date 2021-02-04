// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { CopyText } from './CopyText';

storiesOf('Sticker Creator/elements', module).add('CopyText', () => {
  const label = text('label', 'foo bar');
  const value = text('value', 'foo bar');

  return (
    <StoryRow>
      <CopyText label={label} value={value} />
    </StoryRow>
  );
});
