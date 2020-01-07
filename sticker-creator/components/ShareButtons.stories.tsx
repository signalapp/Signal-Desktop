import * as React from 'react';
import { StoryRow } from '../elements/StoryRow';
import { ShareButtons } from './ShareButtons';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/components', module).add('ShareButtons', () => {
  const value = text('value', 'https://signal.org');

  return (
    <StoryRow>
      <ShareButtons value={value} />
    </StoryRow>
  );
});
