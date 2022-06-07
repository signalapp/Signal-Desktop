// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { StickerPreview } from './StickerPreview';

export default {
  title: 'Sticker Creator/elements',
};

export const _StickerPreview = (): JSX.Element => {
  const image = text('image url', '/fixtures/512x515-thumbs-up-lincoln.webp');

  return (
    <StoryRow>
      <StickerPreview image={image} />
    </StoryRow>
  );
};

_StickerPreview.story = {
  name: 'StickerPreview',
};
