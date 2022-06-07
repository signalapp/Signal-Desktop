// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { CopyText } from './CopyText';

export default {
  title: 'Sticker Creator/elements',
};

export const _CopyText = (): JSX.Element => {
  const label = text('label', 'foo bar');
  const value = text('value', 'foo bar');

  return (
    <StoryRow>
      <CopyText label={label} value={value} />
    </StoryRow>
  );
};

_CopyText.story = {
  name: 'CopyText',
};
