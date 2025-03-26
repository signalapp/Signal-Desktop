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
} from '../../components/fun/data/emojis';
import {
  getEmojiSkinToneDefault,
  getShowStickerPickerHint,
} from '../selectors/items';
import { useItemsActions } from '../ducks/items';
import {
  fetchGifsFeatured,
  fetchGifsSearch,
} from '../../components/fun/data/gifs';
import { tenorDownload } from '../../components/fun/data/tenor';

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
  const recentGifs: Array<GifType> = useMemo(() => [], []);
  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
  const showStickerPickerHint = useSelector(getShowStickerPickerHint);
  const { removeItem, setEmojiSkinToneDefault } = useItemsActions();

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

  const handleEmojiSkinToneDefaultChange = useCallback(
    (emojiSkinTone: EmojiSkinTone) => {
      setEmojiSkinToneDefault(emojiSkinTone);
    },
    [setEmojiSkinToneDefault]
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
      emojiSkinToneDefault={emojiSkinToneDefault}
      onEmojiSkinToneDefaultChange={handleEmojiSkinToneDefaultChange}
      // Stickers
      installedStickerPacks={installedStickerPacks}
      showStickerPickerHint={showStickerPickerHint}
      onClearStickerPickerHint={handleClearStickerPickerHint}
      // Gifs
      fetchGifsSearch={fetchGifsSearch}
      fetchGifsFeatured={fetchGifsFeatured}
      fetchGif={tenorDownload}
    >
      {props.children}
    </FunProvider>
  );
});
