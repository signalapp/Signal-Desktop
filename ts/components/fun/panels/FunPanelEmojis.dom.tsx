// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import {
  Dialog,
  DialogTrigger,
  Heading,
  OverlayArrow,
  Popover,
} from 'react-aria-components';
import { VisuallyHidden } from 'react-aria';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import type { FunEmojisSection } from '../constants.dom.js';
import {
  FunEmojisBase,
  FunEmojisSectionOrder,
  FunSectionCommon,
} from '../constants.dom.js';
import {
  FunGridCell,
  FunGridContainer,
  FunGridHeader,
  FunGridHeaderButton,
  FunGridHeaderIcon,
  FunGridHeaderPopover,
  FunGridHeaderPopoverHeader,
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
  FunSubNavIcon,
  FunSubNavListBox,
  FunSubNavListBoxItem,
} from '../base/FunSubNav.dom.js';
import type { EmojiVariantKey } from '../data/emojis.std.js';
import {
  EmojiSkinTone,
  EmojiPickerCategory,
  getEmojiParentByKey,
  getEmojiPickerCategoryParentKeys,
  getEmojiVariantByParentKeyAndSkinTone,
  normalizeShortNameCompletionDisplay,
  isEmojiVariantKey,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
  EMOJI_PARENT_KEY_CONSTANTS,
  EMOJI_VARIANT_KEY_CONSTANTS,
} from '../data/emojis.std.js';
import { useFunEmojiSearch } from '../useFunEmojiSearch.dom.js';
import { FunKeyboard } from '../keyboard/FunKeyboard.dom.js';
import type { GridKeyboardState } from '../keyboard/GridKeyboardDelegate.dom.js';
import { GridKeyboardDelegate } from '../keyboard/GridKeyboardDelegate.dom.js';
import type {
  CellKey,
  CellLayoutNode,
  GridSectionNode,
} from '../virtual/useFunVirtualGrid.dom.js';
import { useFunVirtualGrid } from '../virtual/useFunVirtualGrid.dom.js';
import { FunSkinTonesList } from '../FunSkinTones.dom.js';
import { FunStaticEmoji } from '../FunEmoji.dom.js';
import { useFunContext } from '../FunProvider.dom.js';
import { FunResults, FunResultsHeader } from '../base/FunResults.dom.js';
import { useFunEmojiLocalizer } from '../useFunEmojiLocalizer.dom.js';
import { FunTooltip } from '../base/FunTooltip.dom.js';

function getTitleForSection(
  i18n: LocalizerType,
  section: FunEmojisSection
): string {
  if (section === FunSectionCommon.SearchResults) {
    return i18n('icu:FunPanelEmojis__SectionTitle--SearchResults');
  }
  if (section === FunSectionCommon.Recents) {
    return i18n('icu:FunPanelEmojis__SectionTitle--Recents');
  }
  if (section === FunEmojisBase.ThisMessage) {
    return i18n('icu:FunPanelEmojis__SectionTitle--ThisMessage');
  }
  if (section === EmojiPickerCategory.SmileysAndPeople) {
    return i18n('icu:FunPanelEmojis__SectionTitle--SmileysAndPeople');
  }
  if (section === EmojiPickerCategory.AnimalsAndNature) {
    return i18n('icu:FunPanelEmojis__SectionTitle--AnimalsAndNature');
  }
  if (section === EmojiPickerCategory.FoodAndDrink) {
    return i18n('icu:FunPanelEmojis__SectionTitle--FoodAndDrink');
  }
  if (section === EmojiPickerCategory.TravelAndPlaces) {
    return i18n('icu:FunPanelEmojis__SectionTitle--TravelAndPlaces');
  }
  if (section === EmojiPickerCategory.Activities) {
    return i18n('icu:FunPanelEmojis__SectionTitle--Activities');
  }
  if (section === EmojiPickerCategory.Objects) {
    return i18n('icu:FunPanelEmojis__SectionTitle--Objects');
  }
  if (section === EmojiPickerCategory.Symbols) {
    return i18n('icu:FunPanelEmojis__SectionTitle--Symbols');
  }
  if (section === EmojiPickerCategory.Flags) {
    return i18n('icu:FunPanelEmojis__SectionTitle--Flags');
  }
  throw missingCaseError(section);
}

const EMOJI_GRID_COLUMNS = 8;
const EMOJI_GRID_CELL_WIDTH = 40;
const EMOJI_GRID_CELL_HEIGHT = 40;

const EMOJI_GRID_SECTION_GAP = 20;
const EMOJI_GRID_HEADER_SIZE = 28;
const EMOJI_GRID_ROW_SIZE = EMOJI_GRID_CELL_HEIGHT;

function toGridSectionNode(
  section: FunEmojisSection,
  emojiKeys: ReadonlyArray<EmojiVariantKey>
): GridSectionNode {
  return {
    id: section,
    key: `section-${section}`,
    header: {
      key: `header-${section}`,
    },
    cells: emojiKeys.map(emojiKey => {
      return {
        key: `cell-${section}-${emojiKey}`,
        value: emojiKey,
      };
    }),
  };
}

function getSelectedSection(
  hasSearchQuery: boolean,
  hasRecentEmojis: boolean
): FunEmojisSection {
  if (hasSearchQuery) {
    return FunSectionCommon.SearchResults;
  }
  if (hasRecentEmojis) {
    return FunSectionCommon.Recents;
  }

  return EmojiPickerCategory.SmileysAndPeople;
}

export type FunEmojiSelection = Readonly<{
  variantKey: EmojiVariantKey;
}>;

export type FunPanelEmojisProps = Readonly<{
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  onClose: () => void;
  showCustomizePreferredReactionsButton: boolean;
  closeOnSelect: boolean;
  messageEmojis?: ReadonlyArray<EmojiVariantKey>;
}>;

export function FunPanelEmojis({
  onSelectEmoji,
  onClose,
  showCustomizePreferredReactionsButton,
  closeOnSelect,
  messageEmojis: unstableMessageEmojis = [],
}: FunPanelEmojisProps): JSX.Element {
  const fun = useFunContext();
  const {
    i18n,
    storedSearchInput,
    onStoredSearchInputChange,
    onOpenCustomizePreferredReactionsModal,
    recentEmojis: unstableRecentEmojis,
    onSelectEmoji: onFunSelectEmoji,
  } = fun;

  const scrollerRef = useRef<HTMLDivElement>(null);

  // Don't update recent emojis or this message emojis while the emoji panel is open
  const [recentEmojis] = useState(unstableRecentEmojis);
  const [messageEmojis] = useState(unstableMessageEmojis);

  const [searchInput, setSearchInput] = useState(storedSearchInput);
  const searchQuery = useMemo(() => searchInput.trim(), [searchInput]);

  const [focusedCellKey, setFocusedCellKey] = useState<CellKey | null>(null);
  const [skinTonePopoverOpen, setSkinTonePopoverOpen] = useState(false);

  const [selectedSection, setSelectedSection] = useState(() => {
    const hasSearchQuery = searchQuery !== '';
    const hasRecentEmojis = recentEmojis.length > 0;
    return getSelectedSection(hasSearchQuery, hasRecentEmojis);
  });

  const searchEmojis = useFunEmojiSearch();

  const sections = useMemo(() => {
    const skinTone = fun.emojiSkinToneDefault ?? EmojiSkinTone.None;

    if (searchQuery !== '') {
      return [
        toGridSectionNode(
          FunSectionCommon.SearchResults,
          searchEmojis(searchQuery).map(result => {
            return getEmojiVariantByParentKeyAndSkinTone(
              result.parentKey,
              skinTone
            ).key;
          })
        ),
      ];
    }

    const result: Array<GridSectionNode> = [];

    for (const section of FunEmojisSectionOrder) {
      if (section === FunEmojisBase.ThisMessage) {
        if (messageEmojis.length > 0) {
          result.push(
            toGridSectionNode(FunEmojisBase.ThisMessage, messageEmojis)
          );
        }
        continue;
      }
      if (section === FunSectionCommon.Recents) {
        if (recentEmojis.length > 0) {
          result.push(
            toGridSectionNode(
              FunSectionCommon.Recents,
              recentEmojis.map(parentKey => {
                return getEmojiVariantByParentKeyAndSkinTone(
                  parentKey,
                  skinTone
                ).key;
              })
            )
          );
        }
        continue;
      }
      const emojiKeys = getEmojiPickerCategoryParentKeys(section);
      result.push(
        toGridSectionNode(
          section,
          emojiKeys.map(parentKey => {
            return getEmojiVariantByParentKeyAndSkinTone(parentKey, skinTone)
              .key;
          })
        )
      );
    }

    return result;
  }, [
    fun.emojiSkinToneDefault,
    searchQuery,
    searchEmojis,
    messageEmojis,
    recentEmojis,
  ]);

  const [virtualizer, layout] = useFunVirtualGrid({
    scrollerRef,
    sections,
    columns: EMOJI_GRID_COLUMNS,
    overscan: 8,
    sectionGap: EMOJI_GRID_SECTION_GAP,
    headerSize: EMOJI_GRID_HEADER_SIZE,
    rowSize: EMOJI_GRID_ROW_SIZE,
    focusedCellKey,
  });

  const keyboard = useMemo(() => {
    return new GridKeyboardDelegate(virtualizer, layout);
  }, [virtualizer, layout]);

  const handleSearchInputChange = useCallback(
    (nextSearchInput: string) => {
      const hasSearchQuery = nextSearchInput.trim() !== '';
      const hasRecentEmojis = recentEmojis.length > 0;
      setSearchInput(nextSearchInput);
      setSelectedSection(getSelectedSection(hasSearchQuery, hasRecentEmojis));
      onStoredSearchInputChange(nextSearchInput);
    },
    [onStoredSearchInputChange, recentEmojis]
  );

  const handleSelectSection = useCallback(
    (section: FunEmojisSection) => {
      const layoutSection = layout.sections.find(s => s.id === section);
      strictAssert(layoutSection != null, `Expected section for ${section}`);
      setSelectedSection(section);
      setSearchInput('');
      virtualizer.scrollToOffset(layoutSection.header.item.start, {
        align: 'start',
      });
    },
    [virtualizer, layout]
  );

  const handleScrollSectionChange = useCallback((id: string) => {
    setSelectedSection(id as FunEmojisSection);
  }, []);

  const handleKeyboardStateChange = useCallback(
    (state: GridKeyboardState) => {
      if (state.cell == null) {
        setFocusedCellKey(null);
        return;
      }
      const { cellKey, sectionKey } = state.cell;
      const section = layout.sections.find(s => s.key === sectionKey);
      strictAssert(section != null, `Expected section for ${sectionKey}`);
      setFocusedCellKey(cellKey);
      setSelectedSection(section.id as FunEmojisSection);
    },
    [layout]
  );

  const handleSelectEmoji = useCallback(
    (emojiSelection: FunEmojiSelection, shouldClose: boolean) => {
      onFunSelectEmoji(emojiSelection);
      onSelectEmoji(emojiSelection);
      if (closeOnSelect || shouldClose) {
        setFocusedCellKey(null);
        onClose();
      }
    },
    [onFunSelectEmoji, onSelectEmoji, onClose, closeOnSelect]
  );

  const handleSkinTonePopoverOpenChange = useCallback((open: boolean) => {
    setSkinTonePopoverOpen(open);
  }, []);

  const handleOpenCustomizePreferredReactionsModal = useCallback(() => {
    onOpenCustomizePreferredReactionsModal();
    onClose();
  }, [onOpenCustomizePreferredReactionsModal, onClose]);

  const hasSearchQuery = useMemo(() => {
    return searchInput.length > 0;
  }, [searchInput]);

  return (
    <FunPanel>
      <FunPanelHeader>
        <FunSearch
          i18n={i18n}
          searchInput={searchInput}
          onSearchInputChange={handleSearchInputChange}
          placeholder={i18n('icu:FunPanelEmojis__SearchLabel')}
          aria-label={i18n('icu:FunPanelEmojis__SearchPlaceholder')}
        />
        {showCustomizePreferredReactionsButton && (
          <button
            type="button"
            aria-label={i18n(
              'icu:FunPanelEmojis__CustomizeReactionsButtonLabel'
            )}
            className="FunPanelEmojis__CustomizePreferredReactionsButton"
            onClick={handleOpenCustomizePreferredReactionsModal}
          >
            <span className="FunPanelEmojis__CustomizePreferredReactionsButton__Icon" />
          </button>
        )}
      </FunPanelHeader>

      {!hasSearchQuery && (
        <FunPanelFooter>
          <FunSubNav>
            <FunSubNavListBox
              aria-label={i18n('icu:FunPanelEmojis__SubNavLabel')}
              selected={selectedSection}
              onSelect={handleSelectSection}
            >
              {recentEmojis.length > 0 && (
                <FunSubNavListBoxItem
                  id={FunSectionCommon.Recents}
                  label={i18n(
                    'icu:FunPanelEmojis__SubNavCategoryLabel--Recents'
                  )}
                >
                  <FunSubNavIcon iconClassName="FunSubNav__Icon--Recents" />
                </FunSubNavListBoxItem>
              )}
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.SmileysAndPeople}
                label={i18n(
                  'icu:FunPanelEmojis__SubNavCategoryLabel--SmileysAndPeople'
                )}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--SmileysAndPeople" />
              </FunSubNavListBoxItem>
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.AnimalsAndNature}
                label={i18n(
                  'icu:FunPanelEmojis__SubNavCategoryLabel--AnimalsAndNature'
                )}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--AnimalsAndNature" />
              </FunSubNavListBoxItem>
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.FoodAndDrink}
                label={i18n(
                  'icu:FunPanelEmojis__SubNavCategoryLabel--FoodAndDrink'
                )}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--FoodAndDrink" />
              </FunSubNavListBoxItem>
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.Activities}
                label={i18n(
                  'icu:FunPanelEmojis__SubNavCategoryLabel--Activities'
                )}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--Activities" />
              </FunSubNavListBoxItem>
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.TravelAndPlaces}
                label={i18n(
                  'icu:FunPanelEmojis__SubNavCategoryLabel--TravelAndPlaces'
                )}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--TravelAndPlaces" />
              </FunSubNavListBoxItem>
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.Objects}
                label={i18n('icu:FunPanelEmojis__SubNavCategoryLabel--Objects')}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--Objects" />
              </FunSubNavListBoxItem>
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.Symbols}
                label={i18n('icu:FunPanelEmojis__SubNavCategoryLabel--Symbols')}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--Symbols" />
              </FunSubNavListBoxItem>
              <FunSubNavListBoxItem
                id={EmojiPickerCategory.Flags}
                label={i18n('icu:FunPanelEmojis__SubNavCategoryLabel--Flags')}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--Flags" />
              </FunSubNavListBoxItem>
            </FunSubNavListBox>
          </FunSubNav>
        </FunPanelFooter>
      )}
      <FunPanelBody>
        <Tooltip.Provider skipDelayDuration={0}>
          <FunScroller
            ref={scrollerRef}
            sectionGap={EMOJI_GRID_SECTION_GAP}
            onScrollSectionChange={handleScrollSectionChange}
          >
            {layout.sections.length === 0 && (
              <FunResults aria-busy={false}>
                <FunResultsHeader>
                  {i18n('icu:FunPanelEmojis__SearchResults__EmptyHeading')}{' '}
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
            {layout.sections.length > 0 && (
              <FunKeyboard
                scrollerRef={scrollerRef}
                keyboard={keyboard}
                onStateChange={handleKeyboardStateChange}
              >
                <FunGridContainer
                  totalSize={layout.totalHeight}
                  columnCount={EMOJI_GRID_COLUMNS}
                  cellWidth={EMOJI_GRID_CELL_WIDTH}
                  cellHeight={EMOJI_GRID_CELL_HEIGHT}
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
                              section.id as FunEmojisSection
                            )}
                          </FunGridHeaderText>
                          {section.id ===
                            EmojiPickerCategory.SmileysAndPeople && (
                            <SectionSkinToneHeaderPopover
                              i18n={i18n}
                              open={skinTonePopoverOpen}
                              onOpenChange={handleSkinTonePopoverOpenChange}
                              onSelectSkinTone={
                                fun.onEmojiSkinToneDefaultChange
                              }
                            />
                          )}
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
                                i18n={i18n}
                                rowIndex={row.rowIndex}
                                cells={row.cells}
                                focusedCellKey={focusedCellKey}
                                emojiSkinToneDefault={fun.emojiSkinToneDefault}
                                onSelectEmoji={handleSelectEmoji}
                                onEmojiSkinToneDefaultChange={
                                  fun.onEmojiSkinToneDefaultChange
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
            )}
          </FunScroller>
        </Tooltip.Provider>
      </FunPanelBody>
    </FunPanel>
  );
}

type RowProps = Readonly<{
  i18n: LocalizerType;
  rowIndex: number;
  cells: ReadonlyArray<CellLayoutNode>;
  focusedCellKey: CellKey | null;
  emojiSkinToneDefault: EmojiSkinTone | null;
  onSelectEmoji: (
    emojiSelection: FunEmojiSelection,
    shouldClose: boolean
  ) => void;
  onEmojiSkinToneDefaultChange: (emojiSkinTone: EmojiSkinTone) => void;
}>;

const Row = memo(function Row(props: RowProps): JSX.Element {
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
            isTabbable={isTabbable}
            emojiSkinToneDefault={props.emojiSkinToneDefault}
            onSelectEmoji={props.onSelectEmoji}
            onEmojiSkinToneDefaultChange={props.onEmojiSkinToneDefaultChange}
          />
        );
      })}
    </FunGridRow>
  );
});

type CellProps = Readonly<{
  i18n: LocalizerType;
  value: string;
  cellKey: CellKey;
  colIndex: number;
  rowIndex: number;
  isTabbable: boolean;
  emojiSkinToneDefault: EmojiSkinTone | null;
  onSelectEmoji: (
    emojiSelection: FunEmojiSelection,
    shouldClose: boolean
  ) => void;
  onEmojiSkinToneDefaultChange: (emojiSkinTone: EmojiSkinTone) => void;
}>;

const Cell = memo(function Cell(props: CellProps): JSX.Element {
  const {
    i18n,
    emojiSkinToneDefault,
    onSelectEmoji,
    onEmojiSkinToneDefaultChange,
  } = props;
  const emojiLocalizer = useFunEmojiLocalizer();

  const popoverTriggerRef = useRef<HTMLButtonElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const handlePopoverOpenChange = useCallback((open: boolean) => {
    setPopoverOpen(open);
  }, []);

  const emojiParent = useMemo(() => {
    const isVariantKey = isEmojiVariantKey(props.value);

    strictAssert(isVariantKey, 'Cell value is not a variant key');

    const parentKey = getEmojiParentKeyByVariantKey(props.value);

    return getEmojiParentByKey(parentKey);
  }, [props.value]);

  const emojiHasSkinToneVariants = useMemo(() => {
    return emojiParent.defaultSkinToneVariants != null;
  }, [emojiParent.defaultSkinToneVariants]);

  const emojiVariant = useMemo(() => {
    const isVariantKey = isEmojiVariantKey(props.value);

    strictAssert(isVariantKey, 'Cell value is not a variant key');

    return getEmojiVariantByKey(props.value);
  }, [props.value]);

  const handleClick = useCallback(
    (event: PointerEvent) => {
      if (emojiHasSkinToneVariants && emojiSkinToneDefault == null) {
        setPopoverOpen(true);
        return;
      }
      const emojiSelection: FunEmojiSelection = {
        variantKey: emojiVariant.key,
      };
      const shouldClose =
        event.nativeEvent.pointerType !== 'mouse' &&
        !(event.ctrlKey || event.metaKey);
      onSelectEmoji(emojiSelection, shouldClose);
    },
    [
      emojiHasSkinToneVariants,
      emojiSkinToneDefault,
      emojiVariant.key,
      onSelectEmoji,
    ]
  );

  const handleLongPress = useCallback(() => {
    if (emojiHasSkinToneVariants) {
      setPopoverOpen(true);
    }
  }, [emojiHasSkinToneVariants]);

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      if (emojiHasSkinToneVariants) {
        event.stopPropagation();
        event.preventDefault();
        setPopoverOpen(true);
      }
    },
    [emojiHasSkinToneVariants]
  );

  const handleSelectSkinTone = useCallback(
    (skinToneSelection: EmojiSkinTone) => {
      const variant = getEmojiVariantByParentKeyAndSkinTone(
        emojiParent.key,
        skinToneSelection
      );
      onEmojiSkinToneDefaultChange(skinToneSelection);
      const emojiSelection: FunEmojiSelection = {
        variantKey: variant.key,
      };
      const shouldClose = true;
      onSelectEmoji(emojiSelection, shouldClose);
    },
    [onEmojiSkinToneDefaultChange, emojiParent.key, onSelectEmoji]
  );

  const emojiName = useMemo(() => {
    return emojiLocalizer.getLocaleShortName(emojiVariant.key);
  }, [emojiVariant.key, emojiLocalizer]);

  const emojiShortNameDisplay = useMemo(() => {
    return normalizeShortNameCompletionDisplay(emojiName);
  }, [emojiName]);

  return (
    <FunGridCell
      data-key={props.cellKey}
      colIndex={props.colIndex}
      rowIndex={props.rowIndex}
    >
      <FunTooltip
        side="top"
        content={`:${emojiShortNameDisplay}:`}
        collisionBoundarySelector=".FunScroller__Viewport"
        collisionPadding={6}
        // `skipDelayDuration=0` doesn't work with `disableHoverableContent`
        // FIX: https://github.com/radix-ui/primitives/pull/3562
        // disableHoverableContent
      >
        <FunItemButton
          ref={popoverTriggerRef}
          excludeFromTabOrder={!props.isTabbable}
          aria-label={emojiName}
          onClick={handleClick}
          onLongPress={handleLongPress}
          onContextMenu={handleContextMenu}
          longPressAccessibilityDescription={i18n(
            'icu:FunPanelEmojis__SkinTonePicker__LongPressAccessibilityDescription'
          )}
        >
          <FunStaticEmoji role="presentation" size={32} emoji={emojiVariant} />
        </FunItemButton>
      </FunTooltip>
      {emojiHasSkinToneVariants && (
        <Popover
          data-fun-overlay
          isOpen={popoverOpen}
          onOpenChange={handlePopoverOpenChange}
          triggerRef={popoverTriggerRef}
          className="FunPanelEmojis__CellPopover"
          placement="bottom"
          offset={6}
        >
          <OverlayArrow className="FunPanelEmojis__CellPopoverOverlayArrow">
            <svg width={12} height={12} viewBox="0 0 12 12">
              <path d="M0 0 L6 6 L12 0" />
            </svg>
          </OverlayArrow>
          <Dialog className="FunPanelEmojis__CellPopoverDialog">
            <VisuallyHidden>
              <Heading slot="title">
                {i18n(
                  'icu:FunPanelEmojis__SkinTonePicker__SelectSkinToneForSelectedEmoji',
                  { emojiName }
                )}
              </Heading>
            </VisuallyHidden>
            <FunSkinTonesList
              i18n={i18n}
              emoji={emojiParent.key}
              skinTone={null}
              onSelectSkinTone={handleSelectSkinTone}
            />
          </Dialog>
        </Popover>
      )}
    </FunGridCell>
  );
});

type SectionSkinToneHeaderPopoverProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSkinTone: (emojiSkinTone: EmojiSkinTone) => void;
}>;

function SectionSkinToneHeaderPopover(
  props: SectionSkinToneHeaderPopoverProps
): JSX.Element {
  const { i18n, onOpenChange, onSelectSkinTone } = props;

  const handleSelectSkinTone = useCallback(
    (emojiSkinTone: EmojiSkinTone) => {
      onSelectSkinTone(emojiSkinTone);
      onOpenChange(false);
    },
    [onSelectSkinTone, onOpenChange]
  );

  return (
    <DialogTrigger isOpen={props.open} onOpenChange={props.onOpenChange}>
      <FunGridHeaderButton
        label={i18n('icu:FunPanelEmojis__ChangeSkinToneButtonLabel')}
      >
        <FunGridHeaderIcon iconClassName="FunGrid__HeaderIcon--More" />
      </FunGridHeaderButton>
      <FunGridHeaderPopover>
        <FunGridHeaderPopoverHeader>
          {i18n('icu:FunPanelEmojis__SkinTonePicker__ChooseDefaultLabel')}
        </FunGridHeaderPopoverHeader>
        <FunSkinTonesList
          i18n={i18n}
          emoji={EMOJI_PARENT_KEY_CONSTANTS.RAISED_HAND}
          skinTone={null}
          onSelectSkinTone={handleSelectSkinTone}
        />
      </FunGridHeaderPopover>
    </DialogTrigger>
  );
}
