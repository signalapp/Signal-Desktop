// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
} from 'react';
import { strictAssert } from '../../util/assert.std.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import type {
  StickerPackType,
  StickerType,
} from '../../state/ducks/stickers.preload.js';
import type { EmojiSkinTone, EmojiParentKey } from './data/emojis.std.js';
import type { FunGifSelection, GifType } from './panels/FunPanelGifs.dom.js';
import { FunPickerTabKey } from './constants.dom.js';
import type {
  fetchGifsFeatured,
  fetchGifsSearch,
} from './data/gifs.preload.js';
import type { tenorDownload } from './data/tenor.preload.js';
import type { FunEmojiSelection } from './panels/FunPanelEmojis.dom.js';
import type { FunStickerSelection } from './panels/FunPanelStickers.dom.js';
import { FunEmojiLocalizationProvider } from './FunEmojiLocalizationProvider.dom.js';

export type FunContextSmartProps = Readonly<{
  i18n: LocalizerType;

  // Recents
  recentEmojis: ReadonlyArray<EmojiParentKey>;
  recentStickers: ReadonlyArray<StickerType>;
  recentGifs: ReadonlyArray<GifType>;

  // Emojis
  emojiSkinToneDefault: EmojiSkinTone | null;
  onEmojiSkinToneDefaultChange: (emojiSkinTone: EmojiSkinTone) => void;
  onOpenCustomizePreferredReactionsModal: () => void;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;

  // Stickers
  installedStickerPacks: ReadonlyArray<StickerPackType>;
  showStickerPickerHint: boolean;
  onClearStickerPickerHint: () => unknown;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;

  // GIFs
  fetchGifsFeatured: typeof fetchGifsFeatured;
  fetchGifsSearch: typeof fetchGifsSearch;
  fetchGif: typeof tenorDownload;
  onSelectGif: (gifSelection: FunGifSelection) => void;
}>;

export type FunContextProps = FunContextSmartProps &
  Readonly<{
    // Open state
    onOpenChange: (open: boolean) => void;

    // Current Tab
    tab: FunPickerTabKey;
    onChangeTab: (key: FunPickerTabKey) => unknown;

    // Search
    storedSearchInput: string;
    onStoredSearchInputChange: (nextSearchInput: string) => void;
    shouldAutoFocus: boolean;
    onChangeShouldAutoFocus: (shouldAutoFocus: boolean) => void;
  }>;

export const FunContext = createContext<FunContextProps | null>(null);

export function useFunContext(): FunContextProps {
  const fun = useContext(FunContext);
  strictAssert(fun != null, 'Must be wrapped with <FunProvider>');
  return fun;
}

type FunProviderInnerProps = FunContextProps & {
  children: React.ReactNode;
};

const FunProviderInner = memo(function FunProviderInner(
  props: FunProviderInnerProps
): JSX.Element {
  return (
    <FunContext.Provider value={props}>{props.children}</FunContext.Provider>
  );
});

export type FunProviderProps = FunContextSmartProps & {
  children: React.ReactNode;
};

export const FunProvider = memo(function FunProvider(
  props: FunProviderProps
): JSX.Element {
  // Current Tab
  const [tab, setTab] = useState<FunPickerTabKey>(FunPickerTabKey.Emoji);
  const handleChangeTab = useCallback((key: FunPickerTabKey) => {
    setTab(key);
  }, []);

  // Search Input
  const [storedSearchInput, setStoredSearchInput] = useState<string>('');
  const handleStoredSearchInputChange = useCallback(
    (newSearchInput: string) => {
      setStoredSearchInput(newSearchInput);
    },
    []
  );

  const [shouldAutoFocus, setShouldAutoFocus] = useState(true);
  const handleChangeShouldAutofocus = useCallback(
    (nextShouldAutoFocus: boolean) => {
      setShouldAutoFocus(nextShouldAutoFocus);
    },
    []
  );

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      return;
    }
    setStoredSearchInput('');
    setShouldAutoFocus(true);
  }, []);

  return (
    <FunEmojiLocalizationProvider i18n={props.i18n}>
      <FunProviderInner
        i18n={props.i18n}
        // Open state
        onOpenChange={handleOpenChange}
        // Current Tab
        tab={tab}
        onChangeTab={handleChangeTab}
        // Search Input
        storedSearchInput={storedSearchInput}
        onStoredSearchInputChange={handleStoredSearchInputChange}
        shouldAutoFocus={shouldAutoFocus}
        onChangeShouldAutoFocus={handleChangeShouldAutofocus}
        // Recents
        recentEmojis={props.recentEmojis}
        recentStickers={props.recentStickers}
        recentGifs={props.recentGifs}
        // Emojis
        emojiSkinToneDefault={props.emojiSkinToneDefault}
        onEmojiSkinToneDefaultChange={props.onEmojiSkinToneDefaultChange}
        onOpenCustomizePreferredReactionsModal={
          props.onOpenCustomizePreferredReactionsModal
        }
        onSelectEmoji={props.onSelectEmoji}
        // Stickers
        installedStickerPacks={props.installedStickerPacks}
        showStickerPickerHint={props.showStickerPickerHint}
        onClearStickerPickerHint={props.onClearStickerPickerHint}
        onSelectSticker={props.onSelectSticker}
        // GIFs
        fetchGifsFeatured={props.fetchGifsFeatured}
        fetchGifsSearch={props.fetchGifsSearch}
        fetchGif={props.fetchGif}
        onSelectGif={props.onSelectGif}
      >
        {props.children}
      </FunProviderInner>
    </FunEmojiLocalizationProvider>
  );
});
