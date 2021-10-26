// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { RenderEmojiPickerProps } from '../../components/conversation/ReactionPicker';
import { SmartEmojiPicker } from './EmojiPicker';

export function renderEmojiPicker({
  ref,
  onClickSettings,
  onPickEmoji,
  onSetSkinTone,
  onClose,
  style,
}: RenderEmojiPickerProps): JSX.Element {
  return (
    <SmartEmojiPicker
      ref={ref}
      onClickSettings={onClickSettings}
      onPickEmoji={onPickEmoji}
      onSetSkinTone={onSetSkinTone}
      onClose={onClose}
      style={style}
    />
  );
}
