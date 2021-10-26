// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import { useRecentEmojis } from '../selectors/emojis';
import { useActions as useEmojiActions } from '../ducks/emojis';

import type { Props as EmojiPickerProps } from '../../components/emoji/EmojiPicker';
import { EmojiPicker } from '../../components/emoji/EmojiPicker';
import { getIntl } from '../selectors/user';
import { getEmojiSkinTone } from '../selectors/items';
import type { LocalizerType } from '../../types/Util';

export const SmartEmojiPicker = React.forwardRef<
  HTMLDivElement,
  Pick<
    EmojiPickerProps,
    'onClickSettings' | 'onPickEmoji' | 'onSetSkinTone' | 'onClose' | 'style'
  >
>(({ onClickSettings, onPickEmoji, onSetSkinTone, onClose, style }, ref) => {
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const skinTone = useSelector<StateType, number>(state =>
    getEmojiSkinTone(state)
  );

  const recentEmojis = useRecentEmojis();

  const { onUseEmoji } = useEmojiActions();

  const handlePickEmoji = React.useCallback(
    data => {
      onUseEmoji({ shortName: data.shortName });
      onPickEmoji(data);
    },
    [onUseEmoji, onPickEmoji]
  );

  return (
    <EmojiPicker
      ref={ref}
      i18n={i18n}
      skinTone={skinTone}
      onClickSettings={onClickSettings}
      onSetSkinTone={onSetSkinTone}
      onPickEmoji={handlePickEmoji}
      recentEmojis={recentEmojis}
      onClose={onClose}
      style={style}
    />
  );
});
