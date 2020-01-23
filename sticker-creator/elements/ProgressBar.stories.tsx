import * as React from 'react';
import { StoryRow } from './StoryRow';
import { ProgressBar } from './ProgressBar';

import { storiesOf } from '@storybook/react';
import { number } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('ProgressBar', () => {
  const count = number('count', 5);
  const total = number('total', 10);

  return (
    <StoryRow>
      <ProgressBar count={count} total={total} />
    </StoryRow>
  );
});
