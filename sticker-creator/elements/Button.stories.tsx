import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { Button } from './Button';

storiesOf('Sticker Creator/elements', module).add('Button', () => {
  const onClick = action('onClick');
  const child = text('text', 'foo bar');

  return (
    <>
      <StoryRow>
        <Button onClick={onClick} primary>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} primary disabled>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick}>{child}</Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} disabled>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} primary pill>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} primary pill disabled>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} pill>
          {child}
        </Button>
      </StoryRow>
      <StoryRow>
        <Button onClick={onClick} pill disabled>
          {child}
        </Button>
      </StoryRow>
    </>
  );
});
