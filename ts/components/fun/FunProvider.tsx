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
import type { GifType } from './panels/FunPanelGifs';
import type { FunGifsSection, FunStickersSection } from './FunConstants';
import {
  type FunEmojisSection,
  FunGifsCategory,
  FunPickerTabKey,
  FunSectionCommon,
  FunStickersSectionBase,
  toFunStickersPackSection,
} from './FunConstants';

export type FunContextSmartProps = Readonly<{
  i18n: LocalizerType;

  // Recents
  recentEmojis: ReadonlyArray<EmojiParentKey>;
  recentStickers: ReadonlyArray<StickerType>;
  recentGifs: ReadonlyArray<GifType>;

  // Emojis
  defaultEmojiSkinTone: EmojiSkinTone;
  onChangeDefaultEmojiSkinTone: (emojiSkinTone: EmojiSkinTone) => void;

  // Stickers
  installedStickerPacks: ReadonlyArray<StickerPackType>;
  showStickerPickerHint: boolean;
  onClearStickerPickerHint: () => unknown;
}>;

export type FunContextProps = FunContextSmartProps &
  Readonly<{
    // Current Tab
    tab: FunPickerTabKey;
    onChangeTab: (key: FunPickerTabKey) => unknown;

    // Search
    searchInput: string;
    onSearchInputChange: (nextSearchInput: string) => void;

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

  // Selected Sections
  const [selectedEmojisSection, setSelectedEmojisSection] = useState(
    (): FunEmojisSection => {
      if (searchQuery !== '') {
        return FunSectionCommon.SearchResults;
      }
      if (props.recentEmojis.length) {
        return FunSectionCommon.Recents;
      }
      return EmojiPickerCategory.SmileysAndPeople;
    }
  );
  const [selectedStickersSection, setSelectedStickersSection] = useState(
    (): FunStickersSection => {
      if (searchQuery !== '') {
        return FunSectionCommon.SearchResults;
      }
      if (props.recentStickers.length > 0) {
        return FunSectionCommon.Recents;
      }
      const firstInstalledStickerPack = props.installedStickerPacks.at(0);
      if (firstInstalledStickerPack != null) {
        return toFunStickersPackSection(firstInstalledStickerPack);
      }
      return FunStickersSectionBase.StickersSetup;
    }
  );
  const [selectedGifsSection, setSelectedGifsSection] = useState(
    (): FunGifsSection => {
      if (searchQuery !== '') {
        return FunSectionCommon.SearchResults;
      }
      if (props.recentGifs.length > 0) {
        return FunSectionCommon.Recents;
      }
      return FunGifsCategory.Trending;
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

  return (
    <FunProviderInner
      i18n={props.i18n}
      // Current Tab
      tab={tab}
      onChangeTab={handleChangeTab}
      // Search Input
      searchInput={searchInput}
      onSearchInputChange={handleSearchInputChange}
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
      defaultEmojiSkinTone={props.defaultEmojiSkinTone}
      onChangeDefaultEmojiSkinTone={props.onChangeDefaultEmojiSkinTone}
      // Stickers
      installedStickerPacks={props.installedStickerPacks}
      showStickerPickerHint={props.showStickerPickerHint}
      onClearStickerPickerHint={props.onClearStickerPickerHint}
    >
      {props.children}
    </FunProviderInner>
  );
});
