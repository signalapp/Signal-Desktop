import * as React from 'react';
import { StoryRow } from './StoryRow';
import { Button } from './Button';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('Button', () => {
  const onClick = action('onClick');
  const child = text('text', 'foo bar');

  return (
    <>
      <StoryRow>
        <Button onClick={onClick} primary={true}>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} primary={true} disabled={true}>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick}>{child}</Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} disabled={true}>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} primary={true} pill={true}>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} primary={true} pill={true} disabled={true}>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} pill={true}>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} pill={true} disabled={true}>
          {child}
        </Button>
      </StoryRow>
    </>
  );
});
