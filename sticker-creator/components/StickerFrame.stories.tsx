// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { StoryRow } from '../elements/StoryRow';
import { StickerFrame } from './StickerFrame';

import type { EmojiPickDataType } from '../../ts/components/emoji/EmojiPicker';

export default {
  title: 'Sticker Creator/components',
};

export const _StickerFrame = (): JSX.Element => {
  const image = text('image url', '/fixtures/512x515-thumbs-up-lincoln.webp');
  const showGuide = boolean('show guide', true);
  const mode = select('mode', ['removable', 'pick-emoji', 'add'], 'add');
  const onRemove = action('onRemove');
  const onDrop = action('onDrop');
  const [skinTone, setSkinTone] = React.useState(0);
  const [emoji, setEmoji] = React.useState<EmojiPickDataType | undefined>(
    undefined
  );

  return (
    <StoryRow top>
      <StickerFrame
        id="1337"
        emojiData={emoji}
        image={image}
        mode={mode}
        showGuide={showGuide}
        onRemove={onRemove}
        skinTone={skinTone}
        onSetSkinTone={setSkinTone}
        onPickEmoji={e => setEmoji(e.emoji)}
        onDrop={onDrop}
      />
    </StoryRow>
  );
};

_StickerFrame.story = {
  name: 'StickerFrame, add sticker',
};

export const EmojiSelectMode = (): JSX.Element => {
  const image = text('image url', '/fixtures/512x515-thumbs-up-lincoln.webp');
  const setSkinTone = action('setSkinTone');
  const onRemove = action('onRemove');
  const onDrop = action('onDrop');
  const [emoji, setEmoji] = React.useState<EmojiPickDataType | undefined>(
    undefined
  );

  return (
    <StoryRow top>
      <StickerFrame
        id="1337"
        emojiData={emoji}
        image={image}
        mode="pick-emoji"
        onRemove={onRemove}
        skinTone={0}
        onSetSkinTone={setSkinTone}
        onPickEmoji={e => setEmoji(e.emoji)}
        onDrop={onDrop}
      />
    </StoryRow>
  );
};

EmojiSelectMode.story = {
  name: 'StickerFrame, emoji select mode',
};
