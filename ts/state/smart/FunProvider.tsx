// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { FunProvider } from '../../components/fun/FunProvider.js';
import { getIntl } from '../selectors/user.js';
import { selectRecentEmojis } from '../selectors/emojis.js';
import type { FunGifSelection } from '../../components/fun/panels/FunPanelGifs.js';
import {
  getInstalledStickerPacks,
  getRecentStickers,
} from '../selectors/stickers.js';
import { strictAssert } from '../../util/assert.js';
import type { EmojiSkinTone } from '../../components/fun/data/emojis.js';
import {
  getEmojiParentKeyByEnglishShortName,
  isEmojiEnglishShortName,
} from '../../components/fun/data/emojis.js';
import {
  getEmojiSkinToneDefault,
  getShowStickerPickerHint,
} from '../selectors/items.js';
import { useItemsActions } from '../ducks/items.js';
import { useGifsActions } from '../ducks/gifs.js';
import {
  fetchGifsFeatured,
  fetchGifsSearch,
} from '../../components/fun/data/gifs.js';
import { tenorDownload } from '../../components/fun/data/tenor.js';
import { usePreferredReactionsActions } from '../ducks/preferredReactions.js';
import { useEmojisActions } from '../ducks/emojis.js';
import { useStickersActions } from '../ducks/stickers.js';
import type { FunStickerSelection } from '../../components/fun/panels/FunPanelStickers.js';
import type { FunEmojiSelection } from '../../components/fun/panels/FunPanelEmojis.js';
import { getRecentGifs } from '../selectors/gifs.js';

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
  const { onAddRecentGif } = useGifsActions();

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
      onUseEmoji({
        shortName: emojiSelection.englishShortName,
        skinTone: emojiSelection.skinTone,
      });
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
      fetchGifsSearch={fetchGifsSearch}
      fetchGifsFeatured={fetchGifsFeatured}
      fetchGif={tenorDownload}
      onSelectGif={handleSelectGif}
    >
      {props.children}
    </FunProvider>
  );
});
