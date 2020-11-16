// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { StickerPreview } from './StickerPreview';

storiesOf('Sticker Creator/elements', module).add('StickerPreview', () => {
  const image = text('image url', '/fixtures/512x515-thumbs-up-lincoln.webp');

  return (
    <StoryRow>
      <StickerPreview image={image} />
    </StoryRow>
  );
});
