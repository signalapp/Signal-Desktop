// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, forwardRef, memo } from 'react';
import { useSelector } from 'react-redux';
import { useRecentEmojis } from '../selectors/emojis';
import { useEmojisActions as useEmojiActions } from '../ducks/emojis';
import type { Props as EmojiPickerProps } from '../../components/emoji/EmojiPicker';
import { EmojiPicker } from '../../components/emoji/EmojiPicker';
import { getIntl } from '../selectors/user';
import { getEmojiSkinToneDefault } from '../selectors/items';
import { EmojiSkinTone } from '../../components/fun/data/emojis';

export const SmartEmojiPicker = memo(
  forwardRef<
    HTMLDivElement,
    Pick<
      EmojiPickerProps,
      | 'onClickSettings'
      | 'onPickEmoji'
      | 'onEmojiSkinToneDefaultChange'
      | 'onClose'
      | 'style'
    >
  >(function SmartEmojiPickerInner(
    {
      onClickSettings,
      onPickEmoji,
      onEmojiSkinToneDefaultChange,
      onClose,
      style,
    },
    ref
  ) {
    const i18n = useSelector(getIntl);
    const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);

    const recentEmojis = useRecentEmojis();
    const { onUseEmoji } = useEmojiActions();

    const handlePickEmoji = useCallback(
      data => {
        onUseEmoji({ shortName: data.shortName, skinTone: EmojiSkinTone.None });
        onPickEmoji(data);
      },
      [onUseEmoji, onPickEmoji]
    );

    return (
      <EmojiPicker
        i18n={i18n}
        onClickSettings={onClickSettings}
        onClose={onClose}
        onEmojiSkinToneDefaultChange={onEmojiSkinToneDefaultChange}
        onPickEmoji={handlePickEmoji}
        recentEmojis={recentEmojis}
        ref={ref}
        emojiSkinToneDefault={emojiSkinToneDefault}
        style={style}
        wasInvokedFromKeyboard={false}
      />
    );
  })
);
