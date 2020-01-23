import * as React from 'react';
import { StoryRow } from './StoryRow';
import { StickerPreview } from './StickerPreview';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('StickerPreview', () => {
  const image = text('image url', '/fixtures/512x515-thumbs-up-lincoln.webp');

  return (
    <StoryRow>
      <StickerPreview image={image} />
    </StoryRow>
  );
});
