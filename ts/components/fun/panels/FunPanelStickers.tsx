// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MouseEvent } from 'react';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import type {
  StickerPackType,
  StickerType,
} from '../../../state/ducks/stickers';
import type { LocalizerType } from '../../../types/I18N';
import { strictAssert } from '../../../util/assert';
import type { FunStickersSection } from '../FunConstants';
import {
  FunSectionCommon,
  FunStickersSectionBase,
  toFunStickersPackSection,
} from '../FunConstants';
import {
  FunGridCell,
  FunGridContainer,
  FunGridHeader,
  FunGridHeaderText,
  FunGridRow,
  FunGridRowGroup,
  FunGridScrollerSection,
} from '../base/FunGrid';
import { FunItemButton, FunItemSticker } from '../base/FunItem';
import { FunPanel } from '../base/FunPanel';
import { FunScroller } from '../base/FunScroller';
import { FunSearch } from '../base/FunSearch';
import {
  FunSubNav,
  FunSubNavButton,
  FunSubNavButtons,
  FunSubNavIcon,
  FunSubNavImage,
  FunSubNavListBox,
  FunSubNavListBoxItem,
  FunSubNavScroller,
} from '../base/FunSubNav';
import {
  emojiVariantConstant,
  getEmojiParentKeyByValue,
  isEmojiParentValue,
  useEmojiSearch,
} from '../data/emojis';
import { FunKeyboard } from '../keyboard/FunKeyboard';
import type { GridKeyboardState } from '../keyboard/GridKeyboardDelegate';
import { GridKeyboardDelegate } from '../keyboard/GridKeyboardDelegate';
import type {
  CellKey,
  CellLayoutNode,
  GridSectionNode,
} from '../virtual/useFunVirtualGrid';
import { useFunVirtualGrid } from '../virtual/useFunVirtualGrid';
import { useFunContext } from '../FunProvider';
import { FunResults, FunResultsHeader } from '../base/FunResults';
import { FunEmoji } from '../FunEmoji';

const STICKER_GRID_COLUMNS = 4;
const STICKER_GRID_CELL_WIDTH = 80;
const STICKER_GRID_CELL_HEIGHT = 80;

const STICKER_GRID_SECTION_GAP = 20;
const STICKER_GRID_HEADER_SIZE = 28;
const STICKER_GRID_ROW_SIZE = STICKER_GRID_CELL_HEIGHT;

type StickerLookup = Record<string, StickerType>;
type StickerPackLookup = Record<string, StickerPackType>;

function getStickerId(sticker: StickerType): string {
  return `${sticker.packId}-${sticker.id}`;
}

function toGridSectionNode(
  section: FunStickersSection,
  stickers: ReadonlyArray<StickerType>
): GridSectionNode {
  return {
    id: section,
    key: `section-${section}`,
    header: {
      key: `header-${section}`,
    },
    cells: stickers.map(sticker => {
      const value = getStickerId(sticker);
      return {
        key: `cell-${section}-${value}`,
        value,
      };
    }),
  };
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
  const packId = section.replace(/^StickerPack:/, '');
  const pack = packs[packId];
  strictAssert(pack != null, `Missing pack for ${packId}`);
  return pack.title;
}

export type FunStickerSelection = Readonly<{
  stickerPackId: string;
  stickerId: number;
}>;

export type FunPanelStickersProps = Readonly<{
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;
  onAddStickerPack: (() => void) | null;
  onClose: () => void;
}>;

export function FunPanelStickers({
  onSelectSticker,
  onAddStickerPack,
  onClose,
}: FunPanelStickersProps): JSX.Element {
  const fun = useFunContext();
  const {
    i18n,
    searchInput,
    onSearchInputChange,
    selectedStickersSection,
    onChangeSelectedStickersSection,
    recentStickers,
    installedStickerPacks,
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
    for (const sticker of recentStickers) {
      result[getStickerId(sticker)] = sticker;
    }
    for (const installedStickerPack of installedStickerPacks) {
      for (const sticker of installedStickerPack.stickers) {
        result[getStickerId(sticker)] = sticker;
      }
    }
    return result;
  }, [recentStickers, installedStickerPacks]);

  const [focusedCellKey, setFocusedCellKey] = useState<CellKey | null>(null);

  const searchEmojis = useEmojiSearch(i18n);
  const searchQuery = useMemo(() => searchInput.trim(), [searchInput]);

  const sections = useMemo(() => {
    if (searchQuery !== '') {
      const emojiKeys = new Set(searchEmojis(searchQuery));

      const allStickers = installedStickerPacks.flatMap(pack => pack.stickers);
      const matchingStickers = allStickers.filter(sticker => {
        if (sticker.emoji == null) {
          return false;
        }
        if (!isEmojiParentValue(sticker.emoji)) {
          return false;
        }
        const parentKey = getEmojiParentKeyByValue(sticker.emoji);
        return emojiKeys.has(parentKey);
      });

      return [
        toGridSectionNode(FunSectionCommon.SearchResults, matchingStickers),
      ];
    }

    const result: Array<GridSectionNode> = [];

    if (recentStickers.length > 0) {
      result.push(toGridSectionNode(FunSectionCommon.Recents, recentStickers));
    }

    for (const pack of installedStickerPacks) {
      const section = toFunStickersPackSection(pack);
      result.push(toGridSectionNode(section, pack.stickers));
    }

    return result;
  }, [recentStickers, installedStickerPacks, searchEmojis, searchQuery]);

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

  const handleSelectSection = useCallback(
    (section: FunStickersSection) => {
      const layoutSection = layout.sections.find(s => s.id === section);
      strictAssert(layoutSection != null, `Missing section to for ${section}`);
      onChangeSelectedStickersSection(section);
      virtualizer.scrollToOffset(layoutSection.header.item.start, {
        align: 'start',
      });
    },
    [virtualizer, layout, onChangeSelectedStickersSection]
  );

  const handleScrollSectionChange = useCallback(
    (sectionId: string) => {
      onChangeSelectedStickersSection(sectionId as FunStickersSection);
    },
    [onChangeSelectedStickersSection]
  );

  const handleKeyboardStateChange = useCallback(
    (state: GridKeyboardState) => {
      if (state.cell == null) {
        setFocusedCellKey(null);
        return;
      }

      setFocusedCellKey(state.cell.cellKey ?? null);
      onChangeSelectedStickersSection(
        state.cell?.sectionKey as FunStickersSection
      );
    },
    [onChangeSelectedStickersSection]
  );

  const hasSearchQuery = useMemo(() => {
    return searchInput.length > 0;
  }, [searchInput]);

  const handlePressSticker = useCallback(
    (event: MouseEvent, stickerSelection: FunStickerSelection) => {
      onSelectSticker(stickerSelection);
      if (!(event.ctrlKey || event.metaKey)) {
        onClose();
      }
    },
    [onSelectSticker, onClose]
  );

  return (
    <FunPanel>
      <FunSearch
        searchInput={searchInput}
        onSearchInputChange={onSearchInputChange}
        placeholder={i18n('icu:FunPanelStickers__SearchPlaceholder')}
        aria-label={i18n('icu:FunPanelStickers__SearchLabel')}
      />
      {!hasSearchQuery && (
        <FunSubNav>
          <FunSubNavScroller>
            {selectedStickersSection != null && (
              <FunSubNavListBox
                aria-label={i18n('icu:FunPanelSticker__SubNavLabel')}
                selected={selectedStickersSection}
                onSelect={handleSelectSection}
              >
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
                        <FunSubNavImage src={installedStickerPack.cover?.url} />
                      )}
                    </FunSubNavListBoxItem>
                  );
                })}
              </FunSubNavListBox>
            )}
          </FunSubNavScroller>
          {onAddStickerPack != null && (
            <FunSubNavButtons>
              <FunSubNavButton onClick={onAddStickerPack}>
                <FunSubNavIcon iconClassName="FunSubNav__Icon--Plus" />
              </FunSubNavButton>
            </FunSubNavButtons>
          )}
        </FunSubNav>
      )}
      <FunScroller
        ref={scrollerRef}
        sectionGap={STICKER_GRID_SECTION_GAP}
        onScrollSectionChange={handleScrollSectionChange}
      >
        {layout.sections.length === 0 && (
          <FunResults aria-busy={false}>
            <FunResultsHeader>
              {i18n('icu:FunPanelStickers__SearchResults__EmptyHeading')}{' '}
              <FunEmoji
                size={16}
                role="presentation"
                // For presentation only
                aria-label=""
                emoji={emojiVariantConstant('\u{1F641}')}
              />
            </FunResultsHeader>
          </FunResults>
        )}
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
                          rowIndex={row.rowIndex}
                          cells={row.cells}
                          stickerLookup={stickerLookup}
                          focusedCellKey={focusedCellKey}
                          onPressSticker={handlePressSticker}
                        />
                      );
                    })}
                  </FunGridRowGroup>
                </FunGridScrollerSection>
              );
            })}
          </FunGridContainer>
        </FunKeyboard>
      </FunScroller>
    </FunPanel>
  );
}

const Row = memo(function Row(props: {
  rowIndex: number;
  stickerLookup: StickerLookup;
  cells: ReadonlyArray<CellLayoutNode>;
  focusedCellKey: CellKey | null;
  onPressSticker: (
    event: MouseEvent,
    stickerSelection: FunStickerSelection
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
            value={cell.value}
            cellKey={cell.key}
            rowIndex={cell.rowIndex}
            colIndex={cell.colIndex}
            stickerLookup={props.stickerLookup}
            isTabbable={isTabbable}
            onPressSticker={props.onPressSticker}
          />
        );
      })}
    </FunGridRow>
  );
});

const Cell = memo(function Cell(props: {
  value: string;
  cellKey: CellKey;
  colIndex: number;
  rowIndex: number;
  stickerLookup: StickerLookup;
  isTabbable: boolean;
  onPressSticker: (
    event: MouseEvent,
    stickerSelection: FunStickerSelection
  ) => void;
}): JSX.Element {
  const { onPressSticker } = props;
  const sticker = props.stickerLookup[props.value];

  const handleClick = useCallback(
    (event: MouseEvent) => {
      onPressSticker(event, {
        stickerPackId: sticker.packId,
        stickerId: sticker.id,
      });
    },
    [sticker, onPressSticker]
  );

  return (
    <FunGridCell
      data-key={props.cellKey}
      colIndex={props.colIndex}
      rowIndex={props.rowIndex}
    >
      <FunItemButton
        tabIndex={props.isTabbable ? 0 : -1}
        aria-label={sticker.emoji ?? 'Sticker'}
        onClick={handleClick}
      >
        <FunItemSticker src={sticker.url} />
      </FunItemButton>
    </FunGridCell>
  );
});
