// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { FunProvider } from '../../components/fun/FunProvider.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import { selectRecentEmojis } from '../selectors/emojis.std.ts';
import type { FunGifSelection } from '../../components/fun/panels/FunPanelGifs.dom.tsx';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import type { EmojiSkinTone } from '../../components/fun/data/emojis.std.ts';
import {
  getEmojiParentKeyByEnglishShortName,
  isEmojiEnglishShortName,
} from '../../components/fun/data/emojis.std.ts';
import {
  getEmojiSkinToneDefault,
  getShowStickerPickerHint,
} from '../selectors/items.dom.ts';
import { useItemsActions } from '../ducks/items.preload.ts';
import { useGifsActions } from '../ducks/gifs.preload.ts';
import {
  fetchGiphySearch,
  fetchGiphyTrending,
  fetchGiphyFile,
} from './fun/giphy.preload.ts';
import { usePreferredReactionsActions } from '../ducks/preferredReactions.preload.ts';
import { useEmojisActions } from '../ducks/emojis.preload.ts';
import { useStickersActions } from '../ducks/stickers.preload.ts';
import type { FunStickerSelection } from '../../components/fun/panels/FunPanelStickers.dom.tsx';
import type { FunEmojiSelection } from '../../components/fun/panels/FunPanelEmojis.dom.tsx';
import { getRecentGifs } from '../selectors/gifs.std.ts';

export type SmartFunProviderProps = Readonly<{
  children: ReactNode;
}>;

export const SmartFunProvider = memo(function SmartFunProvider(
  props: SmartFunProviderProps
) {
  const i18n = useSelector(getIntl);
  const installedStickerPacks = useSelector(getInstalledStickerPacks);
  const recentEmojis = useSelector(selectRecentEmojis);
  const recentStickers = useSelector(getRecentStickers);
  const recentGifs = useSelector(getRecentGifs);
  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
  const showStickerPickerHint = useSelector(getShowStickerPickerHint);

  const { removeItem, setEmojiSkinToneDefault } = useItemsActions();
  const { openCustomizePreferredReactionsModal } =
    usePreferredReactionsActions();
  const { onUseEmoji } = useEmojisActions();
  const { useSticker: onUseSticker } = useStickersActions();
  const { onAddRecentGif, onRemoveRecentGif } = useGifsActions();

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

  // Emojis
  const handleOpenCustomizePreferredReactionsModal = useCallback(() => {
    openCustomizePreferredReactionsModal();
  }, [openCustomizePreferredReactionsModal]);

  const handleSelectEmoji = useCallback(
    (emojiSelection: FunEmojiSelection) => {
      onUseEmoji(emojiSelection);
    },
    [onUseEmoji]
  );

  // Stickers
  const handleClearStickerPickerHint = useCallback(() => {
    removeItem('showStickerPickerHint');
  }, [removeItem]);

  const handleSelectSticker = useCallback(
    (stickerSelection: FunStickerSelection) => {
      onUseSticker(stickerSelection.stickerPackId, stickerSelection.stickerId);
    },
    [onUseSticker]
  );

  // GIFs
  const handleSelectGif = useCallback(
    (gifSelection: FunGifSelection) => {
      onAddRecentGif(gifSelection.gif);
    },
    [onAddRecentGif]
  );

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
      onOpenCustomizePreferredReactionsModal={
        handleOpenCustomizePreferredReactionsModal
      }
      onSelectEmoji={handleSelectEmoji}
      // Stickers
      installedStickerPacks={installedStickerPacks}
      showStickerPickerHint={showStickerPickerHint}
      onClearStickerPickerHint={handleClearStickerPickerHint}
      onSelectSticker={handleSelectSticker}
      // Gifs
      fetchGiphySearch={fetchGiphySearch}
      fetchGiphyTrending={fetchGiphyTrending}
      fetchGiphyFile={fetchGiphyFile}
      onRemoveRecentGif={onRemoveRecentGif}
      onSelectGif={handleSelectGif}
    >
      {props.children}
    </FunProvider>
  );
});
