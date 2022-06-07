// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { PageHeader } from './PageHeader';

export default {
  title: 'Sticker Creator/elements',
};

export const _PageHeader = (): JSX.Element => {
  const child = text('text', 'foo bar');

  return (
    <StoryRow>
      <PageHeader>{child}</PageHeader>
    </StoryRow>
  );
};

_PageHeader.story = {
  name: 'PageHeader',
};
