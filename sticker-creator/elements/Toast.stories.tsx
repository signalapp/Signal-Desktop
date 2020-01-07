import * as React from 'react';
import { StoryRow } from './StoryRow';
import { Toast } from './Toast';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('Toast', () => {
  const child = text('text', 'foo bar');

  return (
    <StoryRow>
      <Toast>{child}</Toast>
    </StoryRow>
  );
});
