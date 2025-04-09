// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { strictAssert } from '../../util/assert';
import type { LocalizerType } from '../../types/I18N';
import type { StickerPackType, StickerType } from '../../state/ducks/stickers';
import type { EmojiSkinTone } from './data/emojis';
import { EmojiPickerCategory, type EmojiParentKey } from './data/emojis';
import type { FunGifSelection, GifType } from './panels/FunPanelGifs';
import type { FunGifsSection, FunStickersSection } from './constants';
import {
  type FunEmojisSection,
  FunGifsCategory,
  FunPickerTabKey,
  FunSectionCommon,
  FunStickersSectionBase,
  toFunStickersPackSection,
} from './constants';
import type { fetchGifsFeatured, fetchGifsSearch } from './data/gifs';
import type { tenorDownload } from './data/tenor';
import type { FunEmojiSelection } from './panels/FunPanelEmojis';
import type { FunStickerSelection } from './panels/FunPanelStickers';
import { FunEmojiLocalizationProvider } from './FunEmojiLocalizationProvider';

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
    searchInput: string;
    onSearchInputChange: (nextSearchInput: string) => void;
    shouldAutoFocus: boolean;
    onChangeShouldAutoFocus: (shouldAutoFocus: boolean) => void;

    // Current Section
    selectedEmojisSection: FunEmojisSection;
    selectedStickersSection: FunStickersSection;
    selectedGifsSection: FunGifsSection;
    onChangeSelectedEmojisSection: (section: FunEmojisSection) => void;
    onChangeSelectedStickersSection: (section: FunStickersSection) => void;
    onChangeSelectedSelectGifsSection: (section: FunGifsSection) => void;
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
  const [searchInput, setSearchInput] = useState<string>('');
  const searchQuery = useMemo(() => searchInput.trim(), [searchInput]);
  const handleSearchInputChange = useCallback((newSearchInput: string) => {
    setSearchInput(newSearchInput);
  }, []);

  const [shouldAutoFocus, setShouldAutoFocus] = useState(true);
  const handleChangeShouldAutofocus = useCallback(
    (nextShouldAutoFocus: boolean) => {
      setShouldAutoFocus(nextShouldAutoFocus);
    },
    []
  );

  const defaultEmojiSection = useMemo((): FunEmojisSection => {
    if (props.recentEmojis.length) {
      return FunSectionCommon.Recents;
    }
    return EmojiPickerCategory.SmileysAndPeople;
  }, [props.recentEmojis]);

  const defaultStickerSection = useMemo((): FunStickersSection => {
    if (props.recentStickers.length > 0) {
      return FunSectionCommon.Recents;
    }
    const firstInstalledStickerPack = props.installedStickerPacks.at(0);
    if (firstInstalledStickerPack != null) {
      return toFunStickersPackSection(firstInstalledStickerPack);
    }
    return FunStickersSectionBase.StickersSetup;
  }, [props.recentStickers, props.installedStickerPacks]);

  const defaultGifsSection = useMemo((): FunGifsSection => {
    if (props.recentGifs.length > 0) {
      return FunSectionCommon.Recents;
    }
    return FunGifsCategory.Trending;
  }, [props.recentGifs]);

  // Selected Sections
  const [selectedEmojisSection, setSelectedEmojisSection] = useState(
    (): FunEmojisSection => {
      if (searchQuery !== '') {
        return FunSectionCommon.SearchResults;
      }
      return defaultEmojiSection;
    }
  );
  const [selectedStickersSection, setSelectedStickersSection] = useState(
    (): FunStickersSection => {
      if (searchQuery !== '') {
        return FunSectionCommon.SearchResults;
      }
      return defaultStickerSection;
    }
  );
  const [selectedGifsSection, setSelectedGifsSection] = useState(
    (): FunGifsSection => {
      if (searchQuery !== '') {
        return FunSectionCommon.SearchResults;
      }
      return defaultGifsSection;
    }
  );
  const handleChangeSelectedEmojisSection = useCallback(
    (section: FunEmojisSection) => {
      setSelectedEmojisSection(section);
    },
    []
  );
  const handleChangeSelectedStickersSection = useCallback(
    (section: FunStickersSection) => {
      setSelectedStickersSection(section);
    },
    []
  );
  const handleChangeSelectedGifsSection = useCallback(
    (section: FunGifsSection) => {
      setSelectedGifsSection(section);
    },
    []
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }
      setSearchInput('');
      setSelectedEmojisSection(defaultEmojiSection);
      setSelectedStickersSection(defaultStickerSection);
      setSelectedGifsSection(defaultGifsSection);
      setShouldAutoFocus(true);
    },
    [defaultEmojiSection, defaultStickerSection, defaultGifsSection]
  );

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
        searchInput={searchInput}
        onSearchInputChange={handleSearchInputChange}
        shouldAutoFocus={shouldAutoFocus}
        onChangeShouldAutoFocus={handleChangeShouldAutofocus}
        // Current Sections
        selectedEmojisSection={selectedEmojisSection}
        selectedStickersSection={selectedStickersSection}
        selectedGifsSection={selectedGifsSection}
        onChangeSelectedEmojisSection={handleChangeSelectedEmojisSection}
        onChangeSelectedStickersSection={handleChangeSelectedStickersSection}
        onChangeSelectedSelectGifsSection={handleChangeSelectedGifsSection}
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
