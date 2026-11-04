// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, PointerEvent, JSX, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VisuallyHidden } from 'react-aria';
import type {
  StickerPackType,
  StickerType,
} from '../../../state/ducks/stickers.preload.ts';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import { strictAssert } from '../../../util/assert.std.ts';
import type {
  FunStickersPackSection,
  FunStickersSection,
  FunTimeStickerStyle,
} from '../constants.dom.tsx';
import {
  FunSectionCommon,
  FunStickersSectionBase,
  FunTimeStickerStylesOrder,
  toFunStickersPackSection,
} from '../constants.dom.tsx';
import {
  FunGridCell,
  FunGridContainer,
  FunGridHeader,
  FunGridHeaderText,
  FunGridRow,
  FunGridRowGroup,
  FunGridScrollerSection,
} from '../base/FunGrid.dom.tsx';
import { FunItemButton } from '../base/FunItem.dom.tsx';
import {
  FunPanel,
  FunPanelBody,
  FunPanelFooter,
  FunPanelHeader,
} from '../base/FunPanel.dom.tsx';
import { FunScroller } from '../base/FunScroller.dom.tsx';
import { FunSearch } from '../base/FunSearch.dom.tsx';
import {
  FunSubNav,
  FunSubNavButton,
  FunSubNavButtons,
  FunSubNavIcon,
  FunSubNavImage,
  FunSubNavListBox,
  FunSubNavListBoxItem,
  FunSubNavScroller,
} from '../base/FunSubNav.dom.tsx';
import { FunKeyboard } from '../keyboard/FunKeyboard.dom.tsx';
import type { GridKeyboardState } from '../keyboard/GridKeyboardDelegate.dom.tsx';
import { GridKeyboardDelegate } from '../keyboard/GridKeyboardDelegate.dom.tsx';
import type {
  CellKey,
  CellLayoutNode,
  GridSectionNode,
} from '../virtual/useFunVirtualGrid.dom.tsx';
import { useFunVirtualGrid } from '../virtual/useFunVirtualGrid.dom.tsx';
import { useFunContext } from '../FunProvider.dom.tsx';
import { FunResults, FunResultsHeader } from '../base/FunResults.dom.tsx';
import { FunStaticEmoji } from '../FunEmoji.dom.tsx';
import {
  FunLightboxPortal,
  FunLightboxBackdrop,
  FunLightboxDialog,
  FunLightboxProvider,
  useFunLightboxKey,
} from '../base/FunLightbox.dom.tsx';
import { FunSticker } from '../FunSticker.dom.tsx';
import { getAnalogTime } from '../../../util/getAnalogTime.std.ts';
import { getDateTimeFormatter } from '../../../util/formatTimestamp.dom.ts';
import { Emoji } from '../../../axo/emoji.std.ts';
import { AxoContextMenu } from '../../../axo/AxoContextMenu.dom.tsx';

const STICKER_GRID_COLUMNS = 4;
const STICKER_GRID_CELL_WIDTH = 80;
const STICKER_GRID_CELL_HEIGHT = 80;

const STICKER_GRID_SECTION_GAP = 20;
const STICKER_GRID_HEADER_SIZE = 28;
const STICKER_GRID_ROW_SIZE = STICKER_GRID_CELL_HEIGHT;

type StickerLookupItemSticker = { kind: 'sticker'; sticker: StickerType };
type StickerLookupItemTimeSticker = {
  kind: 'timeSticker';
  style: FunTimeStickerStyle;
};
type StickerLookupItem =
  | StickerLookupItemSticker
  | StickerLookupItemTimeSticker;

type StickerLookup = Record<string, StickerLookupItem>;
type StickerPackLookup = Record<string, StickerPackType>;

function getStickerId(sticker: StickerType): string {
  return `${sticker.packId}-${sticker.id}`;
}

function getTimeStickerId(style: FunTimeStickerStyle): string {
  return `_timeSticker:${style}`;
}

function toStickerIds(
  stickers: ReadonlyArray<StickerType>
): ReadonlyArray<string> {
  return stickers.map(sticker => getStickerId(sticker));
}

function toGridSectionNode(
  section: FunStickersSection,
  values: ReadonlyArray<string>
): GridSectionNode {
  return {
    id: section,
    key: `section-${section}`,
    header: {
      key: `header-${section}`,
    },
    cells: values.map(value => {
      return {
        key: `cell-${section}-${value}`,
        value,
      };
    }),
  };
}

function getSelectedSection(
  hasSearchQuery: boolean,
  hasFavoriteStickers: boolean,
  hasRecentStickers: boolean,
  firstInstalledStickerPack: StickerPackType | null
): FunStickersSection {
  if (hasSearchQuery) {
    return FunSectionCommon.SearchResults;
  }
  if (hasFavoriteStickers) {
    return FunStickersSectionBase.Favorites;
  }
  if (hasRecentStickers) {
    return FunSectionCommon.Recents;
  }
  if (firstInstalledStickerPack != null) {
    return toFunStickersPackSection(firstInstalledStickerPack);
  }
  return FunStickersSectionBase.StickersSetup;
}

function getTitleForSection(
  i18n: LocalizerType,
  section: FunStickersSection,
  packs: StickerPackLookup
): string {
  if (section === FunSectionCommon.SearchResults) {
    return i18n('icu:FunPanelStickers__SectionTitle--SearchResults');
  }
  if (section === FunSectionCommon.Recents) {
    return i18n('icu:FunPanelStickers__SectionTitle--Recents');
  }
  if (section === FunStickersSectionBase.StickersSetup) {
    return '';
  }
  if (section === FunStickersSectionBase.Favorites) {
    return i18n('icu:FunPanelStickers__SectionTitle--Favorites');
  }
  if (section === FunStickersSectionBase.Featured) {
    return i18n('icu:FunPanelStickers__SectionTitle--Featured');
  }
  // To assert the typescript type:
  const stickerPackSection: FunStickersPackSection = section;
  const packId = stickerPackSection.replace(/^StickerPack:/, '');
  const pack = packs[packId];
  strictAssert(pack != null, `Missing pack for ${packId}`);
  return pack.title;
}

export type FunStickerSelection = Readonly<{
  stickerPackId: string;
  stickerId: number;
  stickerUrl: string;
}>;

export type FunPanelStickersProps = Readonly<{
  showTimeStickers: boolean;
  onSelectTimeSticker?: (style: FunTimeStickerStyle) => void;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;
  onAddStickerPack: (() => void) | null;
  onMarkStickerAsFavorite: (
    stickerSelection: FunStickerSelection,
    markAsFavorite: boolean
  ) => void;
  onClose: () => void;
}>;

export function FunPanelStickers({
  showTimeStickers,
  onSelectTimeSticker,
  onSelectSticker,
  onAddStickerPack,
  onMarkStickerAsFavorite,
  onClose,
}: FunPanelStickersProps): JSX.Element {
  const fun = useFunContext();
  const {
    i18n,
    storedSearchInput,
    onStoredSearchInputChange,
    favoriteStickers,
    isFavoriteStickersEnabled,
    recentStickers,
    installedStickerPacks,
    onSelectSticker: onFunSelectSticker,
  } = fun;

  const scrollerRef = useRef<HTMLDivElement>(null);

  const packsLookup = useMemo(() => {
    const result: Record<string, StickerPackType> = {};
    for (const pack of installedStickerPacks) {
      result[pack.id] = pack;
    }
    return result;
  }, [installedStickerPacks]);

  const stickerLookup = useMemo(() => {
    const result: StickerLookup = {};
    if (isFavoriteStickersEnabled) {
      for (const sticker of favoriteStickers) {
        result[getStickerId(sticker)] = { kind: 'sticker', sticker };
      }
    }
    for (const sticker of recentStickers) {
      result[getStickerId(sticker)] = { kind: 'sticker', sticker };
    }
    for (const installedStickerPack of installedStickerPacks) {
      for (const sticker of installedStickerPack.stickers) {
        result[getStickerId(sticker)] = { kind: 'sticker', sticker };
      }
    }
    for (const style of FunTimeStickerStylesOrder) {
      result[getTimeStickerId(style)] = { kind: 'timeSticker', style };
    }
    return result;
  }, [
    favoriteStickers,
    isFavoriteStickersEnabled,
    recentStickers,
    installedStickerPacks,
  ]);

  const favoriteStickersSet = useMemo(() => {
    const result = new Set<string>();
    for (const sticker of favoriteStickers) {
      result.add(getStickerId(sticker));
    }
    return result;
  }, [favoriteStickers]);

  const [focusedCellKey, setFocusedCellKey] = useState<CellKey | null>(null);
  const [searchInput, setSearchInput] = useState(storedSearchInput);
  const searchQuery = useMemo(() => searchInput.trim(), [searchInput]);

  const [selectedSection, setSelectedSection] = useState(() => {
    const hasSearchQuery = searchQuery !== '';
    const hasFavoriteStickers =
      isFavoriteStickersEnabled && favoriteStickers.length > 0;
    const hasRecentStickers = recentStickers.length > 0;
    const firstInstalledStickerPack = installedStickerPacks.at(0) ?? null;
    return getSelectedSection(
      hasSearchQuery,
      hasFavoriteStickers,
      hasRecentStickers,
      firstInstalledStickerPack
    );
  });

  const sections = useMemo(() => {
    if (searchQuery !== '') {
      const emojis = new Set<Emoji.Parent>(Emoji.search(searchQuery));

      const allStickers = installedStickerPacks.flatMap(pack => pack.stickers);
      const matchingStickers = allStickers.filter(sticker => {
        if (sticker.emoji == null) {
          return false;
        }
        if (!Emoji.isParent(sticker.emoji)) {
          return false;
        }
        return emojis.has(sticker.emoji);
      });

      return [
        toGridSectionNode(
          FunSectionCommon.SearchResults,
          toStickerIds(matchingStickers)
        ),
      ];
    }

    const result: Array<GridSectionNode> = [];

    if (showTimeStickers) {
      result.push(
        toGridSectionNode(
          FunStickersSectionBase.Featured,
          FunTimeStickerStylesOrder.map(style => {
            return getTimeStickerId(style);
          })
        )
      );
    }

    if (isFavoriteStickersEnabled && favoriteStickers.length > 0) {
      result.push(
        toGridSectionNode(
          FunStickersSectionBase.Favorites,
          toStickerIds(favoriteStickers)
        )
      );
    }

    if (recentStickers.length > 0) {
      result.push(
        toGridSectionNode(
          FunSectionCommon.Recents,
          toStickerIds(recentStickers)
        )
      );
    }

    for (const pack of installedStickerPacks) {
      const section = toFunStickersPackSection(pack);
      result.push(toGridSectionNode(section, toStickerIds(pack.stickers)));
    }

    return result;
  }, [
    showTimeStickers,
    favoriteStickers,
    isFavoriteStickersEnabled,
    recentStickers,
    installedStickerPacks,
    searchQuery,
  ]);

  const [virtualizer, layout] = useFunVirtualGrid({
    scrollerRef,
    sections,
    columns: STICKER_GRID_COLUMNS,
    overscan: 8,
    sectionGap: STICKER_GRID_SECTION_GAP,
    headerSize: STICKER_GRID_HEADER_SIZE,
    rowSize: STICKER_GRID_ROW_SIZE,
    focusedCellKey,
  });

  const keyboard = useMemo(() => {
    return new GridKeyboardDelegate(virtualizer, layout);
  }, [virtualizer, layout]);

  const handleSearchInputChange = useCallback(
    (nextSearchInput: string) => {
      const hasSearchQuery = nextSearchInput.trim() !== '';
      const hasFavoriteStickers =
        isFavoriteStickersEnabled && favoriteStickers.length > 0;
      const hasRecentStickers = recentStickers.length > 0;
      const firstInstalledStickerPack = installedStickerPacks.at(0) ?? null;
      setSelectedSection(
        getSelectedSection(
          hasSearchQuery,
          hasFavoriteStickers,
          hasRecentStickers,
          firstInstalledStickerPack
        )
      );
      setSearchInput(nextSearchInput);
      onStoredSearchInputChange(nextSearchInput);
    },
    [
      onStoredSearchInputChange,
      favoriteStickers,
      isFavoriteStickersEnabled,
      recentStickers,
      installedStickerPacks,
    ]
  );

  const handleSelectSection = useCallback(
    (section: FunStickersSection) => {
      const layoutSection = layout.sections.find(s => s.id === section);
      strictAssert(layoutSection != null, `Missing section to for ${section}`);
      setSelectedSection(section);
      setSearchInput('');
      virtualizer.scrollToOffset(layoutSection.header.item.start, {
        align: 'start',
      });
    },
    [virtualizer, layout]
  );

  const handleScrollSectionChange = useCallback((sectionId: string) => {
    setSelectedSection(sectionId as FunStickersSection);
  }, []);

  const handleKeyboardStateChange = useCallback((state: GridKeyboardState) => {
    if (state.cell == null) {
      setFocusedCellKey(null);
      return;
    }

    setFocusedCellKey(state.cell.cellKey ?? null);
    setSelectedSection(state.cell?.sectionKey as FunStickersSection);
  }, []);

  const hasSearchQuery = useMemo(() => {
    return searchInput.length > 0;
  }, [searchInput]);

  const handleClickSticker = useCallback(
    (event: PointerEvent, stickerSelection: FunStickerSelection) => {
      onFunSelectSticker(stickerSelection);
      onSelectSticker(stickerSelection);
      if (!(event.ctrlKey || event.metaKey)) {
        setFocusedCellKey(null);
        onClose();
      }
    },
    [onFunSelectSticker, onSelectSticker, onClose]
  );

  const handleClickTimeSticker = useCallback(
    (event: PointerEvent, style: FunTimeStickerStyle) => {
      onSelectTimeSticker?.(style);
      if (!(event.ctrlKey || event.metaKey)) {
        onClose();
      }
    },
    [onSelectTimeSticker, onClose]
  );

  const showAddStickerPackButton = onAddStickerPack != null;
  const handleAddStickerPack = useCallback(() => {
    strictAssert(onAddStickerPack, 'Missing onAddStickerPack');
    onAddStickerPack();
    onClose();
  }, [onAddStickerPack, onClose]);

  const handleClickStickerAsFavorite = useCallback(
    (stickerSelection: FunStickerSelection, markAsFavorite: boolean) => {
      onMarkStickerAsFavorite(stickerSelection, markAsFavorite);
    },
    [onMarkStickerAsFavorite]
  );

  return (
    <FunPanel>
      <FunPanelHeader>
        <FunSearch
          i18n={i18n}
          searchInput={searchInput}
          onSearchInputChange={handleSearchInputChange}
          placeholder={i18n('icu:FunPanelStickers__SearchPlaceholder')}
          label={i18n('icu:FunPanelStickers__SearchLabel')}
        />
      </FunPanelHeader>
      {!hasSearchQuery && (
        <FunPanelFooter>
          <FunSubNav>
            <FunSubNavScroller>
              {selectedSection != null && (
                <FunSubNavListBox
                  aria-label={i18n('icu:FunPanelSticker__SubNavLabel')}
                  selected={selectedSection}
                  onSelect={handleSelectSection}
                >
                  {isFavoriteStickersEnabled && favoriteStickers.length > 0 && (
                    <FunSubNavListBoxItem
                      id={FunStickersSectionBase.Favorites}
                      label={i18n(
                        'icu:FunPanelStickers__SubNavCategoryLabel--Favorites'
                      )}
                    >
                      <FunSubNavIcon iconClassName="FunSubNav__Icon--Favorites" />
                    </FunSubNavListBoxItem>
                  )}
                  {recentStickers.length > 0 && (
                    <FunSubNavListBoxItem
                      id={FunSectionCommon.Recents}
                      label={i18n(
                        'icu:FunPanelStickers__SubNavCategoryLabel--Recents'
                      )}
                    >
                      <FunSubNavIcon iconClassName="FunSubNav__Icon--Recents" />
                    </FunSubNavListBoxItem>
                  )}
                  {installedStickerPacks.map(installedStickerPack => {
                    return (
                      <FunSubNavListBoxItem
                        key={installedStickerPack.id}
                        id={toFunStickersPackSection(installedStickerPack)}
                        label={installedStickerPack.title}
                      >
                        {installedStickerPack.cover && (
                          <FunSubNavImage
                            src={installedStickerPack.cover?.url}
                          />
                        )}
                      </FunSubNavListBoxItem>
                    );
                  })}
                </FunSubNavListBox>
              )}
            </FunSubNavScroller>
            {showAddStickerPackButton && (
              <FunSubNavButtons>
                <FunSubNavButton onClick={handleAddStickerPack}>
                  <VisuallyHidden>
                    {i18n('icu:FunPanelStickers__SubNavButton--AddStickerPack')}
                  </VisuallyHidden>
                  <FunSubNavIcon iconClassName="FunSubNav__Icon--Plus" />
                </FunSubNavButton>
              </FunSubNavButtons>
            )}
          </FunSubNav>
        </FunPanelFooter>
      )}
      <FunPanelBody>
        <FunScroller
          ref={scrollerRef}
          sectionGap={STICKER_GRID_SECTION_GAP}
          onScrollSectionChange={handleScrollSectionChange}
        >
          {layout.sections.length === 0 && (
            <FunResults aria-busy={false}>
              <FunResultsHeader>
                {i18n('icu:FunPanelStickers__SearchResults__EmptyHeading')}{' '}
                <FunStaticEmoji
                  size={16}
                  role="presentation"
                  emoji={Emoji.SLIGHTLY_FROWNING_FACE}
                />
              </FunResultsHeader>
            </FunResults>
          )}
          <FunLightboxProvider containerRef={scrollerRef}>
            <StickersLightbox i18n={i18n} stickerLookup={stickerLookup} />
            <FunKeyboard
              scrollerRef={scrollerRef}
              keyboard={keyboard}
              onStateChange={handleKeyboardStateChange}
            >
              <FunGridContainer
                totalSize={layout.totalHeight}
                cellWidth={STICKER_GRID_CELL_WIDTH}
                cellHeight={STICKER_GRID_CELL_HEIGHT}
                columnCount={STICKER_GRID_COLUMNS}
              >
                {layout.sections.map(section => {
                  return (
                    <FunGridScrollerSection
                      key={section.key}
                      id={section.id}
                      sectionOffset={section.sectionOffset}
                      sectionSize={section.sectionSize}
                    >
                      <FunGridHeader
                        id={section.header.key}
                        headerOffset={section.header.headerOffset}
                        headerSize={section.header.headerSize}
                      >
                        <FunGridHeaderText>
                          {getTitleForSection(
                            i18n,
                            section.id as FunStickersSection,
                            packsLookup
                          )}
                        </FunGridHeaderText>
                      </FunGridHeader>
                      <FunGridRowGroup
                        aria-labelledby={section.header.key}
                        colCount={section.colCount}
                        rowCount={section.rowCount}
                        rowGroupOffset={section.rowGroup.rowGroupOffset}
                        rowGroupSize={section.rowGroup.rowGroupSize}
                      >
                        {section.rowGroup.rows.map(row => {
                          return (
                            <Row
                              key={row.key}
                              sectionId={section.id}
                              i18n={i18n}
                              rowIndex={row.rowIndex}
                              cells={row.cells}
                              stickerLookup={stickerLookup}
                              favoriteStickersSet={favoriteStickersSet}
                              focusedCellKey={focusedCellKey}
                              isFavoriteStickersEnabled={
                                isFavoriteStickersEnabled
                              }
                              onClickSticker={handleClickSticker}
                              onClickTimeSticker={handleClickTimeSticker}
                              onClickStickerAsFavorite={
                                handleClickStickerAsFavorite
                              }
                            />
                          );
                        })}
                      </FunGridRowGroup>
                    </FunGridScrollerSection>
                  );
                })}
              </FunGridContainer>
            </FunKeyboard>
          </FunLightboxProvider>
        </FunScroller>
      </FunPanelBody>
    </FunPanel>
  );
}

const Row = memo(function Row(props: {
  i18n: LocalizerType;
  rowIndex: number;
  stickerLookup: StickerLookup;
  favoriteStickersSet: Set<string>;
  cells: ReadonlyArray<CellLayoutNode>;
  focusedCellKey: CellKey | null;
  isFavoriteStickersEnabled: boolean;
  sectionId: string;
  onClickSticker: (
    event: PointerEvent,
    stickerSelection: FunStickerSelection
  ) => void;
  onClickTimeSticker: (event: PointerEvent, style: FunTimeStickerStyle) => void;
  onClickStickerAsFavorite: (
    stickerSelection: FunStickerSelection,
    markAsFavorite: boolean
  ) => void;
}): JSX.Element {
  return (
    <FunGridRow rowIndex={props.rowIndex}>
      {props.cells.map(cell => {
        const isTabbable =
          props.focusedCellKey != null
            ? cell.key === props.focusedCellKey
            : cell.rowIndex === 0 && cell.colIndex === 0;
        return (
          <Cell
            key={cell.key}
            i18n={props.i18n}
            value={cell.value}
            cellKey={cell.key}
            rowIndex={cell.rowIndex}
            colIndex={cell.colIndex}
            sectionId={props.sectionId}
            favoriteStickersSet={props.favoriteStickersSet}
            stickerLookup={props.stickerLookup}
            isFavoriteStickersEnabled={props.isFavoriteStickersEnabled}
            isTabbable={isTabbable}
            onClickSticker={props.onClickSticker}
            onClickTimeSticker={props.onClickTimeSticker}
            onClickStickerAsFavorite={props.onClickStickerAsFavorite}
          />
        );
      })}
    </FunGridRow>
  );
});

const Cell = memo(function Cell(props: {
  i18n: LocalizerType;
  value: string;
  cellKey: CellKey;
  colIndex: number;
  rowIndex: number;
  sectionId: string;
  favoriteStickersSet: Set<string>;
  stickerLookup: StickerLookup;
  isFavoriteStickersEnabled: boolean;
  isTabbable: boolean;
  onClickSticker: (
    event: PointerEvent,
    stickerSelection: FunStickerSelection
  ) => void;
  onClickTimeSticker: (event: PointerEvent, style: FunTimeStickerStyle) => void;
  onClickStickerAsFavorite: (
    stickerSelection: FunStickerSelection,
    markAsFavorite: boolean
  ) => void;
}): JSX.Element {
  const {
    i18n,
    isFavoriteStickersEnabled,
    sectionId,
    onClickSticker,
    onClickTimeSticker,
    onClickStickerAsFavorite,
  } = props;

  const isFavoriteSticker = props.favoriteStickersSet.has(props.value);
  const stickerLookupItem = props.stickerLookup[props.value];
  strictAssert(stickerLookupItem, 'Missing stickerLookupItem');

  const handleClick = useCallback(
    (event: PointerEvent) => {
      if (stickerLookupItem.kind === 'sticker') {
        onClickSticker(event, {
          stickerPackId: stickerLookupItem.sticker.packId,
          stickerId: stickerLookupItem.sticker.id,
          stickerUrl: stickerLookupItem.sticker.url,
        });
      } else if (stickerLookupItem.kind === 'timeSticker') {
        onClickTimeSticker(event, stickerLookupItem.style);
      }
    },
    [stickerLookupItem, onClickSticker, onClickTimeSticker]
  );

  const handleClickMarkAsFavorite = useCallback(
    (event: Event, markAsFavorite: boolean) => {
      if (stickerLookupItem.kind === 'sticker') {
        // When unfavoriting from the Favorites list, the sticker disappears so the default
        // behavior to refocus the previous selection can't find the original sticker.
        if (!markAsFavorite && sectionId === FunStickersSectionBase.Favorites) {
          event.preventDefault();
        }

        onClickStickerAsFavorite(
          {
            stickerPackId: stickerLookupItem.sticker.packId,
            stickerId: stickerLookupItem.sticker.id,
            stickerUrl: stickerLookupItem.sticker.url,
          },
          markAsFavorite
        );
      }
    },
    [sectionId, stickerLookupItem, onClickStickerAsFavorite]
  );

  const handleFavorite = useCallback(
    (event: Event) => {
      handleClickMarkAsFavorite(event, true);
    },
    [handleClickMarkAsFavorite]
  );

  const handleUnfavorite = useCallback(
    (event: Event) => {
      handleClickMarkAsFavorite(event, false);
    },
    [handleClickMarkAsFavorite]
  );

  if (stickerLookupItem.kind === 'sticker') {
    if (isFavoriteStickersEnabled) {
      return (
        <FunGridCell
          data-key={props.cellKey}
          colIndex={props.colIndex}
          rowIndex={props.rowIndex}
        >
          <StickerContextMenu
            i18n={i18n}
            onClickFavorite={isFavoriteSticker ? null : handleFavorite}
            onClickUnfavorite={isFavoriteSticker ? handleUnfavorite : null}
          >
            <FunItemButton
              excludeFromTabOrder={!props.isTabbable}
              aria-label={stickerLookupItem.sticker.emoji ?? ''}
              onClick={handleClick}
            >
              <FunSticker
                role="presentation"
                src={stickerLookupItem.sticker.url}
                size={68}
              />
            </FunItemButton>
          </StickerContextMenu>
        </FunGridCell>
      );
    }

    return (
      <FunGridCell
        data-key={props.cellKey}
        colIndex={props.colIndex}
        rowIndex={props.rowIndex}
      >
        <FunItemButton
          excludeFromTabOrder={!props.isTabbable}
          aria-label={stickerLookupItem.sticker.emoji ?? ''}
          onClick={handleClick}
        >
          <FunSticker
            role="presentation"
            src={stickerLookupItem.sticker.url}
            size={68}
          />
        </FunItemButton>
      </FunGridCell>
    );
  }

  return (
    <FunGridCell
      data-key={props.cellKey}
      colIndex={props.colIndex}
      rowIndex={props.rowIndex}
    >
      <FunItemButton
        excludeFromTabOrder={!props.isTabbable}
        aria-label={stickerLookupItem.style}
        onClick={handleClick}
      >
        {stickerLookupItem.kind === 'timeSticker' &&
          stickerLookupItem.style === 'digital' && (
            <DigitalTimeSticker size={68} />
          )}
        {stickerLookupItem.kind === 'timeSticker' &&
          stickerLookupItem.style === 'analog' && (
            <AnalogTimeSticker size={68} />
          )}
      </FunItemButton>
    </FunGridCell>
  );
});

function StickerContextMenu(props: {
  i18n: LocalizerType;
  onClickFavorite: ((event: Event) => void) | null;
  onClickUnfavorite: ((event: Event) => void) | null;
  children: ReactNode;
}) {
  const { i18n, onClickFavorite, onClickUnfavorite } = props;

  return (
    <AxoContextMenu.Root>
      <AxoContextMenu.Trigger>{props.children}</AxoContextMenu.Trigger>
      <AxoContextMenu.Content>
        {onClickFavorite && (
          <AxoContextMenu.Item symbol="star" onSelect={onClickFavorite}>
            {i18n('icu:FunPanelStickers__StickerContextMenu--AddFavorite')}
          </AxoContextMenu.Item>
        )}
        {onClickUnfavorite && (
          <AxoContextMenu.Item symbol="star-slash" onSelect={onClickUnfavorite}>
            {i18n('icu:FunPanelStickers__StickerContextMenu--RemoveFavorite')}
          </AxoContextMenu.Item>
        )}
      </AxoContextMenu.Content>
    </AxoContextMenu.Root>
  );
}

function StickersLightbox(props: {
  i18n: LocalizerType;
  stickerLookup: StickerLookup;
}) {
  const { i18n } = props;
  const key = useFunLightboxKey();
  const stickerLookupItem = useMemo(() => {
    if (key == null) {
      return null;
    }
    const [, , ...stickerIdParts] = key.split('-');
    const stickerId = stickerIdParts.join('-');
    const found = props.stickerLookup[stickerId];
    strictAssert(found, `Must have sticker for "${stickerId}"`);
    return found;
  }, [props.stickerLookup, key]);
  if (stickerLookupItem == null) {
    return null;
  }
  return (
    <FunLightboxPortal>
      <FunLightboxBackdrop>
        <FunLightboxDialog
          aria-label={i18n('icu:FunPanelStickers__LightboxDialog__Label')}
        >
          {stickerLookupItem.kind === 'sticker' && (
            <FunSticker
              role="img"
              aria-label={stickerLookupItem.sticker.emoji ?? ''}
              src={stickerLookupItem.sticker.url}
              size={512}
              ignoreReducedMotion
            />
          )}
          {stickerLookupItem.kind === 'timeSticker' &&
            stickerLookupItem.style === 'digital' && (
              <DigitalTimeSticker size={512} />
            )}
          {stickerLookupItem.kind === 'timeSticker' &&
            stickerLookupItem.style === 'analog' && (
              <AnalogTimeSticker size={512} />
            )}
        </FunLightboxDialog>
      </FunLightboxBackdrop>
    </FunLightboxPortal>
  );
}

function getDigitalTime() {
  return getDateTimeFormatter({ hour: 'numeric', minute: 'numeric' })
    .formatToParts(Date.now())
    .filter(x => x.type !== 'dayPeriod')
    .reduce((acc, { value }) => `${acc}${value}`, '')
    .trim();
}

function DigitalTimeSticker(props: { size: number }) {
  const [digitalTime, setDigitalTime] = useState(() => getDigitalTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setDigitalTime(getDigitalTime());
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <svg
      className="FunPanelStickers__TimeStickerWrapper"
      width={props.size}
      height={props.size}
      viewBox="0 0 512 512"
    >
      <foreignObject x={0} y={0} width={512} height={512}>
        <span className="FunPanelStickers__DigitalTimeSticker">
          {digitalTime}
        </span>
      </foreignObject>
    </svg>
  );
}

function AnalogTimeSticker(props: { size: number }) {
  const [analogTime, setAnalogTime] = useState(() => {
    return getAnalogTime();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setAnalogTime(prev => {
        const current = getAnalogTime();
        if (current.hour === prev.hour && current.minute === prev.minute) {
          return prev;
        }
        return current;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <svg
      className="FunPanelStickers__TimeStickerWrapper"
      width={props.size}
      height={props.size}
      viewBox="0 0 512 512"
    >
      <foreignObject x={0} y={0} width={512} height={512}>
        <span className="FunPanelStickers__AnalogTimeSticker">
          <span
            className="FunPanelStickers__AnalogTimeSticker__HourHand"
            style={
              {
                '--fun-analog-time-sticker-hour': `${analogTime.hour}deg`,
              } as CSSProperties
            }
          />
          <span
            className="FunPanelStickers__AnalogTimeSticker__MinuteHand"
            style={
              {
                '--fun-analog-time-sticker-minute': `${analogTime.minute}deg`,
              } as CSSProperties
            }
          />
        </span>
      </foreignObject>
    </svg>
  );
}
