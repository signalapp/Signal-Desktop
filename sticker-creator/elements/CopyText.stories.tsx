import * as React from 'react';
import { StoryRow } from './StoryRow';
import { CopyText } from './CopyText';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('CopyText', () => {
  const label = text('label', 'foo bar');
  const value = text('value', 'foo bar');

  return (
    <StoryRow>
      <CopyText label={label} value={value} />
    </StoryRow>
  );
});
