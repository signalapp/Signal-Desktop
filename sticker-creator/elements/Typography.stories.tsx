// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-script-url, jsx-a11y/anchor-is-valid */

import * as React from 'react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { H1, H2, Text } from './Typography';

export default {
  title: 'Sticker Creator/elements',
};

export const Typography = (): JSX.Element => {
  const child = text('text', 'foo bar');

  return (
    <>
      <StoryRow left>
        <H1>{child}</H1>
      </StoryRow>
      <StoryRow left>
        <H2>{child}</H2>
      </StoryRow>
      <StoryRow left>
        <Text>
          {child} {child} {child} {child}
        </Text>
      </StoryRow>
      <StoryRow left>
        <Text>
          {child} {child} {child} {child}{' '}
          <a href="javascript: void 0;">
            Something something something dark side.
          </a>
        </Text>
      </StoryRow>
    </>
  );
};
