import * as React from 'react';
import { useSelector } from 'react-redux';
import { get } from 'lodash';
import { StateType } from '../reducer';
import { useActions as useItemActions, useRecentEmojis } from '../ducks/items';
import { useActions as useEmojiActions } from '../ducks/emojis';

import {
  EmojiPicker,
  Props as EmojiPickerProps,
} from '../../components/emoji/EmojiPicker';
import { getIntl } from '../selectors/user';
import { LocalizerType } from '../../types/Util';

export const SmartEmojiPicker = React.forwardRef<
  HTMLDivElement,
  Pick<EmojiPickerProps, 'onPickEmoji' | 'onClose' | 'style'>
>(({ onPickEmoji, onClose, style }, ref) => {
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const skinTone = useSelector<StateType, number>(state =>
    get(state, ['items', 'skinTone'], 0)
  );

  const recentEmojis = useRecentEmojis();

  const { putItem } = useItemActions();

  const onSetSkinTone = React.useCallback(
    tone => {
      putItem('skinTone', tone);
    },
    [putItem]
  );

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
      onSetSkinTone={onSetSkinTone}
      onPickEmoji={handlePickEmoji}
      recentEmojis={recentEmojis}
      onClose={onClose}
      style={style}
    />
  );
});
