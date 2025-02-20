// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { FunProvider } from '../../components/fun/FunProvider';
import { getIntl } from '../selectors/user';
import { selectRecentEmojis } from '../selectors/emojis';
import type { GifType } from '../../components/fun/panels/FunPanelGifs';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers';
import { strictAssert } from '../../util/assert';
import type { EmojiSkinTone } from '../../components/fun/data/emojis';
import {
  getEmojiParentKeyByEnglishShortName,
  isEmojiEnglishShortName,
  NUMBER_TO_SKIN_TONE,
  SKIN_TONE_TO_NUMBER,
} from '../../components/fun/data/emojis';
import { getEmojiSkinTone, getShowStickerPickerHint } from '../selectors/items';
import { useItemsActions } from '../ducks/items';

export type SmartFunProviderProps = Readonly<{
  children: ReactNode;
}>;

export const SmartFunProvider = memo(function SmartFunProvider(
  props: SmartFunProviderProps
) {
  const i18n = useSelector(getIntl);

  // Redux
  const installedStickerPacks = useSelector(getInstalledStickerPacks);
  const recentEmojis = useSelector(selectRecentEmojis);
  const recentStickers = useSelector(getRecentStickers);
  const recentGifs: Array<GifType> = [];
  const emojiSkinTone = useSelector(getEmojiSkinTone);
  const showStickerPickerHint = useSelector(getShowStickerPickerHint);
  const { removeItem, onSetSkinTone } = useItemsActions();

  // Translate recent emojis to keys
  const recentEmojisKeys = useMemo(() => {
    return recentEmojis.map(emojiShortName => {
      strictAssert(
        isEmojiEnglishShortName(emojiShortName),
        `Invalid short name: ${emojiShortName}`
      );
      return getEmojiParentKeyByEnglishShortName(emojiShortName);
    });
  }, [recentEmojis]);

  const defaultEmojiSkinTone = useMemo((): EmojiSkinTone => {
    const result = NUMBER_TO_SKIN_TONE.get(emojiSkinTone);
    strictAssert(result, `Unexpected skin tone preference ${emojiSkinTone}`);
    return result;
  }, [emojiSkinTone]);

  const handleChangeDefaultEmojiSkinTone = useCallback(
    (updated: EmojiSkinTone) => {
      const result = SKIN_TONE_TO_NUMBER.get(updated);
      strictAssert(result, `Unexpected skin tone preference ${updated}`);
      onSetSkinTone(result);
    },
    [onSetSkinTone]
  );

  // Stickers
  const handleClearStickerPickerHint = useCallback(() => {
    removeItem('showStickerPickerHint');
  }, [removeItem]);

  return (
    <FunProvider
      i18n={i18n}
      // Recents
      recentEmojis={recentEmojisKeys}
      recentStickers={recentStickers}
      recentGifs={recentGifs}
      // Emojis
      defaultEmojiSkinTone={defaultEmojiSkinTone}
      onChangeDefaultEmojiSkinTone={handleChangeDefaultEmojiSkinTone}
      // Stickers
      installedStickerPacks={installedStickerPacks}
      showStickerPickerHint={showStickerPickerHint}
      onClearStickerPickerHint={handleClearStickerPickerHint}
    >
      {props.children}
    </FunProvider>
  );
});
