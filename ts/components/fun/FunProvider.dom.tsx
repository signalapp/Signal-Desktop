// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type JSX,
} from 'react';
import { strictAssert } from '../../util/assert.std.ts';
import type { LocalizerType } from '../../types/I18N.std.ts';
import type {
  StickerPackType,
  StickerType,
} from '../../state/ducks/stickers.preload.ts';
import type {
  fetchGiphyFile,
  fetchGiphySearch,
  fetchGiphyTrending,
} from '../../state/smart/fun/giphy.preload.ts';
import type { FunGifSelection, GifType } from './panels/FunPanelGifs.dom.tsx';
import { FunPickerTabKey } from './constants.dom.tsx';
import type { FunEmojiSelection } from './panels/FunPanelEmojis.dom.tsx';
import type { FunStickerSelection } from './panels/FunPanelStickers.dom.tsx';
import type { Emoji } from '../../axo/emoji.std.ts';

export type FunContextSmartProps = Readonly<{
  i18n: LocalizerType;

  // Recents
  recentEmojis: ReadonlyArray<Emoji.Parent>;
  recentStickers: ReadonlyArray<StickerType>;
  recentGifs: ReadonlyArray<GifType>;

  // Emojis
  emojiSkinToneDefault: Emoji.SkinTone | null;
  onEmojiSkinToneDefaultChange: (emojiSkinTone: Emoji.SkinTone) => void;
  onOpenCustomizePreferredReactionsModal: () => void;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;

  // Stickers
  isStickerReplySendEnabled: boolean;
  installedStickerPacks: ReadonlyArray<StickerPackType>;
  showStickerPickerHint: boolean;
  onClearStickerPickerHint: () => unknown;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;

  // GIFs
  fetchGiphyTrending: typeof fetchGiphyTrending;
  fetchGiphySearch: typeof fetchGiphySearch;
  fetchGiphyFile: typeof fetchGiphyFile;
  onRemoveRecentGif: (gifId: string) => void;
  onSelectGif: (gifSelection: FunGifSelection) => void;
}>;

export type FunContextProps = FunContextSmartProps &
  Readonly<{
    // Open state
    isAnyOpen: boolean;
    onAnyOpenChange: (open: boolean) => void;

    // Current Tab
    tab: FunPickerTabKey;
    onChangeTab: (key: FunPickerTabKey) => unknown;

    // Search
    storedSearchInput: string;
    onStoredSearchInputChange: (nextSearchInput: string) => void;
    shouldAutoFocus: boolean;
    onChangeShouldAutoFocus: (shouldAutoFocus: boolean) => void;

    // Sticker reply
    stagedStickerReply: FunStickerSelection | null;
    onStageStickerReply: (selection: FunStickerSelection | null) => void;
  }>;

const FunContext = createContext<FunContextProps | null>(null);

export function useFunContext(): FunContextProps {
  const fun = useContext(FunContext);
  strictAssert(fun != null, 'Must be wrapped with <FunProvider>');
  return fun;
}

export function useFunContextIsAnyOpen(): boolean {
  const fun = useFunContext();
  return fun.isAnyOpen;
}

type FunProviderInnerProps = FunContextProps & {
  children: ReactNode;
};

const FunProviderInner = memo(function FunProviderInner(
  props: FunProviderInnerProps
): JSX.Element {
  return (
    <FunContext.Provider value={props}>{props.children}</FunContext.Provider>
  );
});

export type FunProviderProps = FunContextSmartProps & {
  children: ReactNode;
};

export const FunProvider = memo(function FunProvider(
  props: FunProviderProps
): JSX.Element {
  // Open state
  const [isAnyOpen, setIsAnyOpen] = useState(false);

  // Current Tab
  const [tab, setTab] = useState<FunPickerTabKey>(FunPickerTabKey.EmojisTab);

  // Search Input
  const [storedSearchInput, setStoredSearchInput] = useState<string>('');

  // Sticker reply
  const [stagedStickerReply, setStagedStickerReply] =
    useState<FunStickerSelection | null>(null);

  const [shouldAutoFocus, setShouldAutoFocus] = useState(true);

  // Callbacks
  const handleAnyOpenChange = useCallback((open: boolean) => {
    setIsAnyOpen(open);
    if (open) {
      return;
    }
    setStoredSearchInput('');
    setShouldAutoFocus(true);
  }, []);

  const handleChangeTab = useCallback((key: FunPickerTabKey) => {
    setTab(key);
  }, []);

  const handleStoredSearchInputChange = useCallback(
    (newSearchInput: string) => {
      setStoredSearchInput(newSearchInput);
    },
    []
  );

  const handleStageStickerReply = useCallback(
    (selection: FunStickerSelection | null) => {
      setStagedStickerReply(selection);
    },
    []
  );

  const handleChangeShouldAutofocus = useCallback(
    (nextShouldAutoFocus: boolean) => {
      setShouldAutoFocus(nextShouldAutoFocus);
    },
    []
  );

  return (
    <FunProviderInner
      i18n={props.i18n}
      // Open state
      isAnyOpen={isAnyOpen}
      onAnyOpenChange={handleAnyOpenChange}
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
      isStickerReplySendEnabled={props.isStickerReplySendEnabled}
      installedStickerPacks={props.installedStickerPacks}
      showStickerPickerHint={props.showStickerPickerHint}
      stagedStickerReply={stagedStickerReply}
      onClearStickerPickerHint={props.onClearStickerPickerHint}
      onSelectSticker={props.onSelectSticker}
      onStageStickerReply={handleStageStickerReply}
      // GIFs
      fetchGiphyTrending={props.fetchGiphyTrending}
      fetchGiphySearch={props.fetchGiphySearch}
      fetchGiphyFile={props.fetchGiphyFile}
      onRemoveRecentGif={props.onRemoveRecentGif}
      onSelectGif={props.onSelectGif}
    >
      {props.children}
    </FunProviderInner>
  );
});
