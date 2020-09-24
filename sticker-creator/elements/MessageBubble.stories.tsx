import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { number, text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { MessageBubble } from './MessageBubble';

storiesOf('Sticker Creator/elements', module).add('MessageBubble', () => {
  const child = text('text', 'Foo bar banana baz');
  const minutesAgo = number('minutesAgo', 3);

  return (
    <StoryRow>
      <MessageBubble minutesAgo={minutesAgo}>{child}</MessageBubble>
    </StoryRow>
  );
});
