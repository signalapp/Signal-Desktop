import * as React from 'react';
import { StoryRow } from './StoryRow';
import { PageHeader } from './PageHeader';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('PageHeader', () => {
  const child = text('text', 'foo bar');

  return (
    <StoryRow>
      <PageHeader>{child}</PageHeader>
    </StoryRow>
  );
});
