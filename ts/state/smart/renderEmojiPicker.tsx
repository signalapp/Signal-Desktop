// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { RenderEmojiPickerProps } from '../../components/conversation/ReactionPicker';
import { SmartEmojiPicker } from './EmojiPicker';

export function renderEmojiPicker({
  ref,
  onPickEmoji,
  onClose,
  style,
}: RenderEmojiPickerProps): JSX.Element {
  return (
    <SmartEmojiPicker
      ref={ref}
      onPickEmoji={onPickEmoji}
      onClose={onClose}
      style={style}
    />
  );
}
