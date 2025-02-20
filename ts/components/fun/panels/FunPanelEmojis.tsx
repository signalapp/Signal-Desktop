// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MouseEvent } from 'react';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { DialogTrigger } from 'react-aria-components';
import type { LocalizerType } from '../../../types/I18N';
import { strictAssert } from '../../../util/assert';
import { missingCaseError } from '../../../util/missingCaseError';
import type { FunEmojisSection } from '../FunConstants';
import { FunEmojisSectionOrder, FunSectionCommon } from '../FunConstants';
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
import { FunPanel } from '../base/FunPanel';
import { FunScroller } from '../base/FunScroller';
import { FunSearch } from '../base/FunSearch';
import {
  FunSubNav,
  FunSubNavIcon,
  FunSubNavListBox,
  FunSubNavListBoxItem,
} from '../base/FunSubNav';
import type {
  EmojiParentKey,
  EmojiSkinTone,
  EmojiVariantKey,
} from '../data/emojis';
import {
  EmojiPickerCategory,
  emojiVariantConstant,
  getEmojiParentByKey,
  getEmojiParentKeyByValueUnsafe,
  getEmojiPickerCategoryParentKeys,
  getEmojiVariantByParentKeyAndSkinTone,
  isEmojiParentKey,
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
import { SkinTonesListBox } from '../base/FunSkinTones';
import { FunEmoji } from '../FunEmoji';
import { useFunContext } from '../FunProvider';
import { FunResults, FunResultsHeader } from '../base/FunResults';

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
  onEmojiSelect: (emojiSelection: FunEmojiSelection) => void;
  onClose: () => void;
}>;

export function FunPanelEmojis({
  onEmojiSelect,
  onClose,
}: FunPanelEmojisProps): JSX.Element {
  const fun = useFunContext();
  const {
    i18n,
    searchInput,
    onSearchInputChange,
    selectedEmojisSection,
    onChangeSelectedEmojisSection,
    recentEmojis,
  } = fun;

  const scrollerRef = useRef<HTMLDivElement>(null);

  const [focusedCellKey, setFocusedCellKey] = useState<CellKey | null>(null);

  const searchEmojis = useEmojiSearch(i18n);
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

  const handlePressEmoji = useCallback(
    (event: MouseEvent, emojiSelection: FunEmojiSelection) => {
      onEmojiSelect(emojiSelection);
      // TODO(jamie): Quill is stealing focus updating the selection
      if (!(event.ctrlKey || event.metaKey)) {
        onClose();
      }
    },
    [onEmojiSelect, onClose]
  );

  const hasSearchQuery = useMemo(() => {
    return searchInput.length > 0;
  }, [searchInput]);

  return (
    <FunPanel>
      <FunSearch
        searchInput={searchInput}
        onSearchInputChange={onSearchInputChange}
        placeholder={i18n('icu:FunPanelEmojis__SearchLabel')}
        aria-label={i18n('icu:FunPanelEmojis__SearchPlaceholder')}
      />
      {!hasSearchQuery && (
        <FunSubNav>
          <FunSubNavListBox
            aria-label={i18n('icu:FunPanelEmojis__SubNavLabel')}
            selected={selectedEmojisSection}
            onSelect={handleSelectSection}
          >
            {recentEmojis.length > 0 && (
              <FunSubNavListBoxItem
                id={FunSectionCommon.Recents}
                label={i18n('icu:FunPanelEmojis__SubNavCategoryLabel--Recents')}
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
      )}
      <FunScroller
        ref={scrollerRef}
        sectionGap={EMOJI_GRID_SECTION_GAP}
        onScrollSectionChange={handleScrollSectionChange}
      >
        {layout.sections.length === 0 && (
          <FunResults aria-busy={false}>
            <FunResultsHeader>
              {i18n('icu:FunPanelEmojis__SearchResults__EmptyHeading')}{' '}
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
                      {section.id === EmojiPickerCategory.SmileysAndPeople && (
                        <SectionSkinTonePopover
                          i18n={i18n}
                          skinTone={fun.defaultEmojiSkinTone}
                          onSelectSkinTone={fun.onChangeDefaultEmojiSkinTone}
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
                            rowIndex={row.rowIndex}
                            cells={row.cells}
                            focusedCellKey={focusedCellKey}
                            defaultEmojiSkinTone={fun.defaultEmojiSkinTone}
                            onPressEmoji={handlePressEmoji}
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
    </FunPanel>
  );
}

type RowProps = Readonly<{
  rowIndex: number;
  cells: ReadonlyArray<CellLayoutNode>;
  focusedCellKey: CellKey | null;
  defaultEmojiSkinTone: EmojiSkinTone;
  onPressEmoji: (event: MouseEvent, emojiSelection: FunEmojiSelection) => void;
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
            value={cell.value}
            cellKey={cell.key}
            rowIndex={cell.rowIndex}
            colIndex={cell.colIndex}
            isTabbable={isTabbable}
            defaultEmojiSkinTone={props.defaultEmojiSkinTone}
            onPressEmoji={props.onPressEmoji}
          />
        );
      })}
    </FunGridRow>
  );
});

type CellProps = Readonly<{
  value: string;
  cellKey: CellKey;
  colIndex: number;
  rowIndex: number;
  isTabbable: boolean;
  defaultEmojiSkinTone: EmojiSkinTone;
  onPressEmoji: (event: MouseEvent, emojiSelection: FunEmojiSelection) => void;
}>;

const Cell = memo(function Cell(props: CellProps): JSX.Element {
  const { onPressEmoji } = props;

  const emojiParent = useMemo(() => {
    strictAssert(
      isEmojiParentKey(props.value),
      'Cell value is not an emoji key'
    );
    return getEmojiParentByKey(props.value);
  }, [props.value]);

  const skinTone = useMemo(() => {
    // TODO(jamie): Need to implement emoji-specific skin tone preferences
    return props.defaultEmojiSkinTone;
  }, [props.defaultEmojiSkinTone]);

  const emojiVariant = useMemo(() => {
    return getEmojiVariantByParentKeyAndSkinTone(emojiParent.key, skinTone);
  }, [emojiParent, skinTone]);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      onPressEmoji(event, {
        variantKey: emojiVariant.key,
        parentKey: emojiParent.key,
        englishShortName: emojiParent.englishShortNameDefault,
        skinTone,
      });
    },
    [emojiVariant, emojiParent, onPressEmoji, skinTone]
  );

  return (
    <FunGridCell
      data-key={props.cellKey}
      colIndex={props.colIndex}
      rowIndex={props.rowIndex}
    >
      <FunItemButton
        tabIndex={props.isTabbable ? 0 : -1}
        // TODO(jamie): Translate short name
        aria-label={emojiParent.englishShortNameDefault}
        onClick={handleClick}
      >
        <FunEmoji
          role="presentation"
          aria-label=""
          size={32}
          emoji={emojiVariant}
        />
      </FunItemButton>
    </FunGridCell>
  );
});

type SectionSkinTonePopoverProps = Readonly<{
  i18n: LocalizerType;
  skinTone: EmojiSkinTone;
  onSelectSkinTone: (emojiSkinTone: EmojiSkinTone) => void;
}>;

function SectionSkinTonePopover(
  props: SectionSkinTonePopoverProps
): JSX.Element {
  const { i18n, onSelectSkinTone } = props;
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectSkinTone = useCallback(
    (emojiSkinTone: EmojiSkinTone) => {
      onSelectSkinTone(emojiSkinTone);
      setIsOpen(false);
    },
    [onSelectSkinTone]
  );

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <FunGridHeaderButton
        label={i18n('icu:FunPanelEmojis__ChangeSkinToneButtonLabel')}
      >
        <FunGridHeaderIcon iconClassName="FunGrid__HeaderIcon--Settings" />
      </FunGridHeaderButton>
      <FunGridHeaderPopover>
        <FunGridHeaderPopoverHeader>
          {i18n('icu:FunPanelEmojis__SkinTonePicker__ChooseDefaultLabel')}
        </FunGridHeaderPopoverHeader>
        <SkinTonesListBox
          emoji={getEmojiParentKeyByValueUnsafe('\u{270B}')}
          skinTone={props.skinTone}
          onSelectSkinTone={handleSelectSkinTone}
        />
      </FunGridHeaderPopover>
    </DialogTrigger>
  );
}
