// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, PointerEvent } from 'react';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { VisuallyHidden } from 'react-aria';
import type {
  StickerPackType,
  StickerType,
} from '../../../state/ducks/stickers.preload.js';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import type {
  FunStickersPackSection,
  FunStickersSection,
  FunTimeStickerStyle,
} from '../constants.dom.js';
import {
  FunSectionCommon,
  FunStickersSectionBase,
  FunTimeStickerStylesOrder,
  toFunStickersPackSection,
} from '../constants.dom.js';
import {
  FunGridCell,
  FunGridContainer,
  FunGridHeader,
  FunGridHeaderText,
  FunGridRow,
  FunGridRowGroup,
  FunGridScrollerSection,
} from '../base/FunGrid.dom.js';
import { FunItemButton } from '../base/FunItem.dom.js';
import {
  FunPanel,
  FunPanelBody,
  FunPanelFooter,
  FunPanelHeader,
} from '../base/FunPanel.dom.js';
import { FunScroller } from '../base/FunScroller.dom.js';
import { FunSearch } from '../base/FunSearch.dom.js';
import {
  FunSubNav,
  FunSubNavButton,
  FunSubNavButtons,
  FunSubNavIcon,
  FunSubNavImage,
  FunSubNavListBox,
  FunSubNavListBoxItem,
  FunSubNavScroller,
} from '../base/FunSubNav.dom.js';
import {
  EMOJI_VARIANT_KEY_CONSTANTS,
  type EmojiParentKey,
  getEmojiParentKeyByValue,
  getEmojiVariantByKey,
  isEmojiParentValue,
} from '../data/emojis.std.js';
import { FunKeyboard } from '../keyboard/FunKeyboard.dom.js';
import type { GridKeyboardState } from '../keyboard/GridKeyboardDelegate.dom.js';
import { GridKeyboardDelegate } from '../keyboard/GridKeyboardDelegate.dom.js';
import type {
  CellKey,
  CellLayoutNode,
  GridSectionNode,
} from '../virtual/useFunVirtualGrid.dom.js';
import { useFunVirtualGrid } from '../virtual/useFunVirtualGrid.dom.js';
import { useFunContext } from '../FunProvider.dom.js';
import { FunResults, FunResultsHeader } from '../base/FunResults.dom.js';
import { FunStaticEmoji } from '../FunEmoji.dom.js';
import {
  FunLightboxPortal,
  FunLightboxBackdrop,
  FunLightboxDialog,
  FunLightboxProvider,
  useFunLightboxKey,
} from '../base/FunLightbox.dom.js';
import { FunSticker } from '../FunSticker.dom.js';
import { getAnalogTime } from '../../../util/getAnalogTime.std.js';
import { getDateTimeFormatter } from '../../../util/formatTimestamp.dom.js';
import { useFunEmojiSearch } from '../useFunEmojiSearch.dom.js';

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
  hasRecentStickers: boolean,
  firstInstalledStickerPack: StickerPackType | null
): FunStickersSection {
  if (hasSearchQuery) {
    return FunSectionCommon.SearchResults;
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
  onClose: () => void;
}>;

export function FunPanelStickers({
  showTimeStickers,
  onSelectTimeSticker,
  onSelectSticker,
  onAddStickerPack,
  onClose,
}: FunPanelStickersProps): JSX.Element {
  const fun = useFunContext();
  const {
    i18n,
    storedSearchInput,
    onStoredSearchInputChange,
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
  }, [recentStickers, installedStickerPacks]);

  const [focusedCellKey, setFocusedCellKey] = useState<CellKey | null>(null);
  const [searchInput, setSearchInput] = useState(storedSearchInput);
  const searchQuery = useMemo(() => searchInput.trim(), [searchInput]);

  const [selectedSection, setSelectedSection] = useState(() => {
    const hasSearchQuery = searchQuery !== '';
    const hasRecentStickers = recentStickers.length > 0;
    const firstInstalledStickerPack = installedStickerPacks.at(0) ?? null;
    return getSelectedSection(
      hasSearchQuery,
      hasRecentStickers,
      firstInstalledStickerPack
    );
  });

  const searchEmojis = useFunEmojiSearch();

  const sections = useMemo(() => {
    if (searchQuery !== '') {
      const emojiKeys = new Set<EmojiParentKey>();

      for (const result of searchEmojis(searchQuery)) {
        emojiKeys.add(result.parentKey);
      }

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
    recentStickers,
    installedStickerPacks,
    searchEmojis,
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
      const hasRecentStickers = recentStickers.length > 0;
      const firstInstalledStickerPack = installedStickerPacks.at(0) ?? null;
      setSelectedSection(
        getSelectedSection(
          hasSearchQuery,
          hasRecentStickers,
          firstInstalledStickerPack
        )
      );
      setSearchInput(nextSearchInput);
      onStoredSearchInputChange(nextSearchInput);
    },
    [onStoredSearchInputChange, recentStickers, installedStickerPacks]
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

  return (
    <FunPanel>
      <FunPanelHeader>
        <FunSearch
          i18n={i18n}
          searchInput={searchInput}
          onSearchInputChange={handleSearchInputChange}
          placeholder={i18n('icu:FunPanelStickers__SearchPlaceholder')}
          aria-label={i18n('icu:FunPanelStickers__SearchLabel')}
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
            {onAddStickerPack != null && (
              <FunSubNavButtons>
                <FunSubNavButton onClick={onAddStickerPack}>
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
                  emoji={getEmojiVariantByKey(
                    EMOJI_VARIANT_KEY_CONSTANTS.SLIGHTLY_FROWNING_FACE
                  )}
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
                              rowIndex={row.rowIndex}
                              cells={row.cells}
                              stickerLookup={stickerLookup}
                              focusedCellKey={focusedCellKey}
                              onClickSticker={handleClickSticker}
                              onClickTimeSticker={handleClickTimeSticker}
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
  rowIndex: number;
  stickerLookup: StickerLookup;
  cells: ReadonlyArray<CellLayoutNode>;
  focusedCellKey: CellKey | null;
  onClickSticker: (
    event: PointerEvent,
    stickerSelection: FunStickerSelection
  ) => void;
  onClickTimeSticker: (event: PointerEvent, style: FunTimeStickerStyle) => void;
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
            onClickSticker={props.onClickSticker}
            onClickTimeSticker={props.onClickTimeSticker}
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
  onClickSticker: (
    event: PointerEvent,
    stickerSelection: FunStickerSelection
  ) => void;
  onClickTimeSticker: (event: PointerEvent, style: FunTimeStickerStyle) => void;
}): JSX.Element {
  const { onClickSticker, onClickTimeSticker } = props;
  const stickerLookupItem = props.stickerLookup[props.value];

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

  return (
    <FunGridCell
      data-key={props.cellKey}
      colIndex={props.colIndex}
      rowIndex={props.rowIndex}
    >
      <FunItemButton
        excludeFromTabOrder={!props.isTabbable}
        aria-label={
          stickerLookupItem.kind === 'sticker'
            ? (stickerLookupItem.sticker.emoji ?? '')
            : stickerLookupItem.style
        }
        onClick={handleClick}
      >
        {stickerLookupItem.kind === 'sticker' && (
          <FunSticker
            role="presentation"
            src={stickerLookupItem.sticker.url}
            size={68}
          />
        )}
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
