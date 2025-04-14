// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MouseEvent } from 'react';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  Heading,
  OverlayArrow,
  Popover,
} from 'react-aria-components';
import type { PressEvent } from 'react-aria';
import { VisuallyHidden } from 'react-aria';
import type { LocalizerType } from '../../../types/I18N';
import { strictAssert } from '../../../util/assert';
import { missingCaseError } from '../../../util/missingCaseError';
import type { FunEmojisSection } from '../constants';
import { FunEmojisSectionOrder, FunSectionCommon } from '../constants';
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
} from '../base/FunGrid';
import { FunItemButton } from '../base/FunItem';
import {
  FunPanel,
  FunPanelBody,
  FunPanelFooter,
  FunPanelHeader,
} from '../base/FunPanel';
import { FunScroller } from '../base/FunScroller';
import { FunSearch } from '../base/FunSearch';
import {
  FunSubNav,
  FunSubNavIcon,
  FunSubNavListBox,
  FunSubNavListBoxItem,
} from '../base/FunSubNav';
import type { EmojiParentKey, EmojiVariantKey } from '../data/emojis';
import {
  EmojiSkinTone,
  emojiParentKeyConstant,
  EmojiPickerCategory,
  emojiVariantConstant,
  getEmojiParentByKey,
  getEmojiPickerCategoryParentKeys,
  getEmojiVariantByParentKeyAndSkinTone,
  isEmojiParentKey,
} from '../data/emojis';
import { useFunEmojiSearch } from '../useFunEmojiSearch';
import { FunKeyboard } from '../keyboard/FunKeyboard';
import type { GridKeyboardState } from '../keyboard/GridKeyboardDelegate';
import { GridKeyboardDelegate } from '../keyboard/GridKeyboardDelegate';
import type {
  CellKey,
  CellLayoutNode,
  GridSectionNode,
} from '../virtual/useFunVirtualGrid';
import { useFunVirtualGrid } from '../virtual/useFunVirtualGrid';
import { FunSkinTonesList } from '../FunSkinTones';
import { FunStaticEmoji } from '../FunEmoji';
import { useFunContext } from '../FunProvider';
import { FunResults, FunResultsHeader } from '../base/FunResults';
import { useFunEmojiLocalizer } from '../useFunEmojiLocalizer';

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
  emojiParentKeys: ReadonlyArray<EmojiParentKey>
): GridSectionNode {
  return {
    id: section,
    key: `section-${section}`,
    header: {
      key: `header-${section}`,
    },
    cells: emojiParentKeys.map(emojiParentKey => {
      return {
        key: `cell-${section}-${emojiParentKey}`,
        value: emojiParentKey,
      };
    }),
  };
}

export type FunEmojiSelection = Readonly<{
  variantKey: EmojiVariantKey;
  parentKey: EmojiParentKey;
  englishShortName: string;
  skinTone: EmojiSkinTone;
}>;

export type FunPanelEmojisProps = Readonly<{
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  onClose: () => void;
  showCustomizePreferredReactionsButton: boolean;
  closeOnSelect: boolean;
}>;

export function FunPanelEmojis({
  onSelectEmoji,
  onClose,
  showCustomizePreferredReactionsButton,
  closeOnSelect,
}: FunPanelEmojisProps): JSX.Element {
  const fun = useFunContext();
  const {
    i18n,
    searchInput,
    onSearchInputChange,
    selectedEmojisSection,
    onChangeSelectedEmojisSection,
    onOpenCustomizePreferredReactionsModal,
    recentEmojis: unstableRecentEmojis,
    onSelectEmoji: onFunSelectEmoji,
  } = fun;

  const scrollerRef = useRef<HTMLDivElement>(null);

  // Don't update recent emojis while the emoji panel is open
  const [recentEmojis] = useState(unstableRecentEmojis);
  const [focusedCellKey, setFocusedCellKey] = useState<CellKey | null>(null);
  const [skinTonePopoverOpen, setSkinTonePopoverOpen] = useState(false);

  const handleSkinTonePopoverOpenChange = useCallback((open: boolean) => {
    setSkinTonePopoverOpen(open);
  }, []);

  const searchEmojis = useFunEmojiSearch();
  const searchQuery = useMemo(() => fun.searchInput.trim(), [fun.searchInput]);

  const sections = useMemo(() => {
    if (searchQuery !== '') {
      return [
        toGridSectionNode(
          FunSectionCommon.SearchResults,
          searchEmojis(searchQuery)
        ),
      ];
    }

    const result: Array<GridSectionNode> = [];

    for (const section of FunEmojisSectionOrder) {
      if (section === FunSectionCommon.Recents) {
        if (recentEmojis.length > 0) {
          result.push(
            toGridSectionNode(FunSectionCommon.Recents, recentEmojis)
          );
        }
        continue;
      }
      const emojiKeys = getEmojiPickerCategoryParentKeys(section);
      result.push(toGridSectionNode(section, emojiKeys));
    }

    return result;
  }, [recentEmojis, searchQuery, searchEmojis]);

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

  const handleSelectSection = useCallback(
    (section: FunEmojisSection) => {
      const layoutSection = layout.sections.find(s => s.id === section);
      strictAssert(layoutSection != null, `Expected section for ${section}`);
      onChangeSelectedEmojisSection(section);
      virtualizer.scrollToOffset(layoutSection.header.item.start, {
        align: 'start',
      });
    },
    [virtualizer, layout, onChangeSelectedEmojisSection]
  );

  const handleScrollSectionChange = useCallback(
    (id: string) => {
      onChangeSelectedEmojisSection(id as FunEmojisSection);
    },
    [onChangeSelectedEmojisSection]
  );

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
      onChangeSelectedEmojisSection(section.id as FunEmojisSection);
    },
    [onChangeSelectedEmojisSection, layout]
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
          onSearchInputChange={onSearchInputChange}
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
              selected={selectedEmojisSection}
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
                  emoji={emojiVariantConstant('\u{1F641}')}
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
                            onSelectSkinTone={fun.onEmojiSkinToneDefaultChange}
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
    strictAssert(
      isEmojiParentKey(props.value),
      'Cell value is not an emoji key'
    );
    return getEmojiParentByKey(props.value);
  }, [props.value]);

  const emojiHasSkinToneVariants = useMemo(() => {
    return emojiParent.defaultSkinToneVariants != null;
  }, [emojiParent.defaultSkinToneVariants]);

  const skinTone = useMemo(() => {
    return emojiSkinToneDefault ?? EmojiSkinTone.None;
  }, [emojiSkinToneDefault]);

  const emojiVariant = useMemo(() => {
    return getEmojiVariantByParentKeyAndSkinTone(emojiParent.key, skinTone);
  }, [emojiParent, skinTone]);

  const handlePress = useCallback(
    (event: PressEvent) => {
      if (emojiHasSkinToneVariants && emojiSkinToneDefault == null) {
        setPopoverOpen(true);
        return;
      }
      const emojiSelection: FunEmojiSelection = {
        variantKey: emojiVariant.key,
        parentKey: emojiParent.key,
        englishShortName: emojiParent.englishShortNameDefault,
        skinTone,
      };
      const shouldClose =
        (event.pointerType === 'keyboard' || event.pointerType === 'virtual') &&
        !(event.ctrlKey || event.metaKey);
      onSelectEmoji(emojiSelection, shouldClose);
    },
    [
      emojiHasSkinToneVariants,
      emojiSkinToneDefault,
      emojiVariant,
      emojiParent,
      onSelectEmoji,
      skinTone,
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
        parentKey: emojiParent.key,
        englishShortName: emojiParent.englishShortNameDefault,
        skinTone: skinToneSelection,
      };
      const shouldClose = true;
      onSelectEmoji(emojiSelection, shouldClose);
    },
    [
      onEmojiSkinToneDefaultChange,
      emojiParent.key,
      emojiParent.englishShortNameDefault,
      onSelectEmoji,
    ]
  );

  const emojiName = emojiLocalizer(emojiVariant.key);

  return (
    <FunGridCell
      data-key={props.cellKey}
      colIndex={props.colIndex}
      rowIndex={props.rowIndex}
    >
      <FunItemButton
        ref={popoverTriggerRef}
        tabIndex={props.isTabbable ? 0 : -1}
        aria-label={emojiName}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onContextMenu={handleContextMenu}
        longPressAccessibilityDescription={i18n(
          'icu:FunPanelEmojis__SkinTonePicker__LongPressAccessibilityDescription'
        )}
      >
        <FunStaticEmoji role="presentation" size={32} emoji={emojiVariant} />
      </FunItemButton>
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
          emoji={emojiParentKeyConstant('\u{270B}')}
          skinTone={null}
          onSelectSkinTone={handleSelectSkinTone}
        />
      </FunGridHeaderPopover>
    </DialogTrigger>
  );
}
