import * as React from 'react';
import { StoryRow } from './StoryRow';
import { Toast } from './Toast';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

storiesOf('Sticker Creator/elements', module).add('Toast', () => {
  const child = text('text', 'foo bar');

  return (
    <StoryRow>
      <Toast onClick={action('click')}>{child}</Toast>
    </StoryRow>
  );
});
