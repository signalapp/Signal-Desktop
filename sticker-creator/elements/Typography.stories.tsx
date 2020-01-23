import * as React from 'react';
import { StoryRow } from './StoryRow';
import { H1, H2, Text } from './Typography';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('Typography', () => {
  const child = text('text', 'foo bar');

  return (
    <>
      <StoryRow left={true}>
        <H1>{child}</H1>
      </StoryRow>
      <StoryRow left={true}>
        <H2>{child}</H2>
      </StoryRow>
      <StoryRow left={true}>
        <Text>
          {child} {child} {child} {child}
        </Text>
      </StoryRow>
      <StoryRow left={true}>
        <Text>
          {child} {child} {child} {child}{' '}
          <a href="javascript: void 0;">
            Something something something dark side.
          </a>
        </Text>
      </StoryRow>
    </>
  );
});
