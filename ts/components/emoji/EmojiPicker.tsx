// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import type {
  GridCellRenderer,
  SectionRenderedParams,
} from 'react-virtualized';
import { AutoSizer, Grid } from 'react-virtualized';
import {
  chunk,
  clamp,
  debounce,
  findLast,
  flatMap,
  initial,
  last,
  zipObject,
} from 'lodash';
import { FocusScope } from 'react-aria';
import { dataByCategory } from './lib';
import type { LocalizerType } from '../../types/Util';
import { isSingleGrapheme } from '../../util/grapheme';
import { missingCaseError } from '../../util/missingCaseError';
import { useEmojiSearch } from '../../hooks/useEmojiSearch';
import { FunStaticEmoji } from '../fun/FunEmoji';
import { strictAssert } from '../../util/assert';
import {
  EMOJI_SKIN_TONE_ORDER,
  emojiParentKeyConstant,
  EmojiSkinTone,
  emojiVariantConstant,
  getEmojiParentKeyByEnglishShortName,
  getEmojiVariantByParentKeyAndSkinTone,
  isEmojiEnglishShortName,
  EMOJI_SKIN_TONE_TO_NUMBER,
} from '../fun/data/emojis';

export type EmojiPickDataType = {
  skinTone: EmojiSkinTone;
  shortName: string;
};

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly recentEmojis?: ReadonlyArray<string>;
  readonly emojiSkinToneDefault: EmojiSkinTone | null;
  readonly onClickSettings?: () => unknown;
  readonly onClose?: () => unknown;
  readonly onPickEmoji: (o: EmojiPickDataType) => unknown;
  readonly onEmojiSkinToneDefaultChange?: (
    emojiSkinTone: EmojiSkinTone
  ) => void;
  readonly wasInvokedFromKeyboard: boolean;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

function isEventFromMouse(
  event:
    | React.MouseEvent<HTMLButtonElement>
    | React.KeyboardEvent<HTMLButtonElement>
): boolean {
  return (
    ('clientX' in event && event.clientX !== 0) ||
    ('clientY' in event && event.clientY !== 0)
  );
}

function focusOnRender(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

const COL_COUNT = 8;

const categories = [
  'recents',
  'emoji',
  'animal',
  'food',
  'activity',
  'travel',
  'object',
  'symbol',
  'flag',
] as const;

type Category = (typeof categories)[number];

export const EmojiPicker = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    (
      {
        i18n,
        onPickEmoji,
        emojiSkinToneDefault,
        onEmojiSkinToneDefaultChange,
        recentEmojis = [],
        style,
        onClickSettings,
        onClose,
        wasInvokedFromKeyboard,
      }: Props,
      ref
    ) => {
      const isRTL = i18n.getLocaleDirection() === 'rtl';

      const [isUsingKeyboard, setIsUsingKeyboard] = React.useState(
        wasInvokedFromKeyboard
      );

      const [firstRecent] = React.useState(recentEmojis);
      const [selectedCategory, setSelectedCategory] = React.useState<Category>(
        categories[0]
      );
      const [searchMode, setSearchMode] = React.useState(false);
      const [searchText, setSearchText] = React.useState('');
      const [scrollToRow, setScrollToRow] = React.useState(0);
      const [selectedTone, setSelectedTone] =
        React.useState(emojiSkinToneDefault);

      const search = useEmojiSearch(i18n.getLocale());

      const handleToggleSearch = React.useCallback(
        (
          e:
            | React.MouseEvent<HTMLButtonElement>
            | React.KeyboardEvent<HTMLButtonElement>
        ) => {
          if (isEventFromMouse(e)) {
            setIsUsingKeyboard(false);
          }
          e.stopPropagation();
          e.preventDefault();

          setSearchText('');
          setSelectedCategory(categories[0]);
          setSearchMode(m => !m);
        },
        [setSearchText, setSearchMode]
      );

      const debounceSearchChange = React.useMemo(
        () =>
          debounce((query: string) => {
            setScrollToRow(0);
            setSearchText(query);
          }, 200),
        [setSearchText, setScrollToRow]
      );

      const handleSearchChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          debounceSearchChange(e.currentTarget.value);
        },
        [debounceSearchChange]
      );

      const handlePickEmoji = React.useCallback(
        (
          e:
            | React.MouseEvent<HTMLButtonElement>
            | React.KeyboardEvent<HTMLButtonElement>
        ) => {
          const { shortName } = e.currentTarget.dataset;
          if ('key' in e) {
            if (e.key === 'Enter') {
              if (shortName && isUsingKeyboard) {
                onPickEmoji({
                  skinTone: selectedTone ?? EmojiSkinTone.None,
                  shortName,
                });
                e.stopPropagation();
                e.preventDefault();
              } else if (onClose) {
                onClose();
                e.stopPropagation();
                e.preventDefault();
              }
            }
          } else if (shortName) {
            if (isEventFromMouse(e)) {
              setIsUsingKeyboard(false);
            }
            e.stopPropagation();
            e.preventDefault();
            onPickEmoji({
              skinTone: selectedTone ?? EmojiSkinTone.None,
              shortName,
            });
          }
        },
        [
          onClose,
          onPickEmoji,
          isUsingKeyboard,
          selectedTone,
          setIsUsingKeyboard,
        ]
      );

      // Handle key presses, particularly Escape
      React.useEffect(() => {
        const handler = (event: KeyboardEvent) => {
          if (event.key === 'Tab') {
            // We do NOT prevent default here to allow Tab to be used normally
            setIsUsingKeyboard(true);
            return;
          }
          if (event.key === 'Escape') {
            if (searchMode) {
              event.preventDefault();
              event.stopPropagation();
              setScrollToRow(0);
              setSearchText('');
              setSearchMode(false);
            } else if (onClose) {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          } else if (!searchMode && !event.ctrlKey && !event.metaKey) {
            if (
              [
                'ArrowUp',
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
                'Enter',
                'Shift',
                ' ', // Space
              ].includes(event.key)
            ) {
              // Do nothing, these can be used to navigate around the picker.
            } else if (isSingleGrapheme(event.key)) {
              // A single grapheme means the user is typing text. Switch to search mode.
              setSelectedCategory(categories[0]);
              setSearchMode(true);
              // Continue propagation, typing the first letter for search.
            } else {
              // For anything else, assume it's a special key that isn't one of the ones
              // above (such as Delete or ContextMenu).
              onClose?.();
              event.preventDefault();
              event.stopPropagation();
            }
          }
        };

        document.addEventListener('keydown', handler);

        return () => {
          document.removeEventListener('keydown', handler);
        };
      }, [onClose, setIsUsingKeyboard, searchMode, setSearchMode]);

      const [, ...renderableCategories] = categories;

      const emojiGrid = React.useMemo(() => {
        if (searchText) {
          return chunk(search(searchText), COL_COUNT);
        }

        const chunks = flatMap(renderableCategories, cat =>
          chunk(
            dataByCategory[cat].map(e => e.short_name),
            COL_COUNT
          )
        );

        return [...chunk(firstRecent, COL_COUNT), ...chunks];
      }, [firstRecent, renderableCategories, searchText, search]);

      const rowCount = emojiGrid.length;

      const catRowEnds = React.useMemo(() => {
        const rowEnds: Array<number> = [
          Math.ceil(firstRecent.length / COL_COUNT) - 1,
        ];

        renderableCategories.forEach(cat => {
          rowEnds.push(
            Math.ceil(dataByCategory[cat].length / COL_COUNT) +
              (last(rowEnds) as number)
          );
        });

        return rowEnds;
      }, [firstRecent.length, renderableCategories]);

      const catToRowOffsets = React.useMemo(() => {
        const offsets = initial(catRowEnds).map(i => i + 1);

        return zipObject(categories, [0, ...offsets]);
      }, [catRowEnds]);

      const catOffsetEntries = React.useMemo(
        () => Object.entries(catToRowOffsets),
        [catToRowOffsets]
      );

      const handleSelectCategory = React.useCallback(
        (
          e:
            | React.MouseEvent<HTMLButtonElement>
            | React.KeyboardEvent<HTMLButtonElement>
        ) => {
          e.stopPropagation();
          e.preventDefault();

          const { category } = e.currentTarget.dataset;
          if (category) {
            setSelectedCategory(category as Category);
            setScrollToRow(catToRowOffsets[category]);
          }
        },
        [catToRowOffsets, setSelectedCategory, setScrollToRow]
      );

      const cellRenderer = React.useCallback<GridCellRenderer>(
        ({ key, style: cellStyle, rowIndex, columnIndex }) => {
          const shortName = emojiGrid[rowIndex][columnIndex];

          if (!shortName) {
            return null;
          }

          strictAssert(
            isEmojiEnglishShortName(shortName),
            'Must be a valid emoji short name'
          );
          const parentKey = getEmojiParentKeyByEnglishShortName(shortName);
          const variantKey = getEmojiVariantByParentKeyAndSkinTone(
            parentKey,
            selectedTone ?? EmojiSkinTone.None
          );

          return (
            <div
              key={key}
              className="module-emoji-picker__body__emoji-cell"
              style={cellStyle}
            >
              <button
                type="button"
                className="module-emoji-picker__button"
                onClick={handlePickEmoji}
                onKeyDown={handlePickEmoji}
                data-short-name={shortName}
                title={shortName}
              >
                <FunStaticEmoji
                  role="presentation"
                  emoji={variantKey}
                  size={28}
                />
              </button>
            </div>
          );
        },
        [emojiGrid, handlePickEmoji, selectedTone]
      );

      const getRowHeight = React.useCallback(
        ({ index }: { index: number }) => {
          if (searchText) {
            return 34;
          }

          if (catRowEnds.includes(index) && index !== last(catRowEnds)) {
            return 44;
          }

          return 34;
        },
        [catRowEnds, searchText]
      );

      const onSectionRendered = React.useMemo(
        () =>
          debounce(({ rowStartIndex }: SectionRenderedParams) => {
            const [cat] =
              findLast(catOffsetEntries, ([, row]) => rowStartIndex >= row) ||
              categories;

            setSelectedCategory(cat as Category);
          }, 10),
        [catOffsetEntries]
      );

      function getCategoryButtonLabel(category: Category): string {
        switch (category) {
          case 'recents':
            return i18n('icu:EmojiPicker__button--recents');
          case 'emoji':
            return i18n('icu:EmojiPicker__button--emoji');
          case 'animal':
            return i18n('icu:EmojiPicker__button--animal');
          case 'food':
            return i18n('icu:EmojiPicker__button--food');
          case 'activity':
            return i18n('icu:EmojiPicker__button--activity');
          case 'travel':
            return i18n('icu:EmojiPicker__button--travel');
          case 'object':
            return i18n('icu:EmojiPicker__button--object');
          case 'symbol':
            return i18n('icu:EmojiPicker__button--symbol');
          case 'flag':
            return i18n('icu:EmojiPicker__button--flag');
          default:
            throw missingCaseError(category);
        }
      }

      return (
        <FocusScope contain>
          <div className="module-emoji-picker" ref={ref} style={style}>
            <header className="module-emoji-picker__header">
              <button
                type="button"
                onClick={handleToggleSearch}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === 'Select') {
                    handleToggleSearch(event);
                  }
                }}
                title={
                  searchMode
                    ? i18n('icu:EmojiPicker--search-close')
                    : i18n('icu:EmojiPicker--search-placeholder')
                }
                className={classNames(
                  'module-emoji-picker__button',
                  'module-emoji-picker__button--icon',
                  searchMode
                    ? 'module-emoji-picker__button--icon--close'
                    : 'module-emoji-picker__button--icon--search'
                )}
                aria-label={i18n('icu:EmojiPicker--search-placeholder')}
              />
              {searchMode ? (
                <div className="module-emoji-picker__header__search-field">
                  <input
                    ref={focusOnRender}
                    className="module-emoji-picker__header__search-field__input"
                    placeholder={i18n('icu:EmojiPicker--search-placeholder')}
                    onChange={handleSearchChange}
                    dir="auto"
                  />
                </div>
              ) : (
                categories.map(cat =>
                  cat === 'recents' && firstRecent.length === 0 ? null : (
                    <button
                      aria-pressed={selectedCategory === cat}
                      type="button"
                      key={cat}
                      data-category={cat}
                      title={cat}
                      onClick={handleSelectCategory}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === 'Space') {
                          handleSelectCategory(event);
                        }
                      }}
                      className={classNames(
                        'module-emoji-picker__button',
                        'module-emoji-picker__button--icon',
                        `module-emoji-picker__button--icon--${cat}`,
                        selectedCategory === cat
                          ? 'module-emoji-picker__button--selected'
                          : null
                      )}
                      aria-label={getCategoryButtonLabel(cat)}
                    />
                  )
                )
              )}
            </header>
            {rowCount > 0 ? (
              <div>
                <AutoSizer>
                  {({ width, height }) => (
                    <Grid
                      key={searchText}
                      className="module-emoji-picker__body"
                      width={width}
                      height={height}
                      columnCount={COL_COUNT}
                      columnWidth={38}
                      // react-virtualized Grid default style has direction: 'ltr'
                      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                      rowHeight={getRowHeight}
                      rowCount={rowCount}
                      cellRenderer={cellRenderer}
                      // In some cases, `scrollToRow` can be too high for a short period
                      //   during state changes. This ensures that the value is never too
                      //   large.
                      scrollToRow={clamp(scrollToRow, 0, rowCount - 1)}
                      scrollToAlignment="start"
                      onSectionRendered={onSectionRendered}
                    />
                  )}
                </AutoSizer>
              </div>
            ) : (
              <div
                className={classNames(
                  'module-emoji-picker__body',
                  'module-emoji-picker__body--empty'
                )}
              >
                {i18n('icu:EmojiPicker--empty')}
                <span
                  style={{
                    display: 'inline-block',
                    marginInlineStart: '4px',
                  }}
                >
                  <FunStaticEmoji
                    role="presentation"
                    // Slightly Frowning Face
                    emoji={emojiVariantConstant('\u{1F641}')}
                    size={16}
                  />
                </span>
              </div>
            )}
            <footer className="module-emoji-picker__footer">
              {Boolean(onClickSettings) && (
                <button
                  aria-label={i18n('icu:CustomizingPreferredReactions__title')}
                  className="module-emoji-picker__button module-emoji-picker__button--footer module-emoji-picker__button--settings"
                  onClick={event => {
                    if (onClickSettings) {
                      event.preventDefault();
                      event.stopPropagation();

                      onClickSettings();
                    }
                  }}
                  onKeyDown={event => {
                    if (
                      onClickSettings &&
                      (event.key === 'Enter' || event.key === 'Space')
                    ) {
                      event.preventDefault();
                      event.stopPropagation();

                      onClickSettings();
                    }
                  }}
                  title={i18n('icu:CustomizingPreferredReactions__title')}
                  type="button"
                />
              )}
              {onEmojiSkinToneDefaultChange != null ? (
                <div className="module-emoji-picker__footer__skin-tones">
                  {EMOJI_SKIN_TONE_ORDER.map(emojiSkinTone => {
                    return (
                      <button
                        aria-pressed={selectedTone === emojiSkinTone}
                        type="button"
                        key={emojiSkinTone}
                        data-tone={emojiSkinTone}
                        onClick={() => {
                          setIsUsingKeyboard(false);
                          setSelectedTone(emojiSkinTone);
                          onEmojiSkinToneDefaultChange(emojiSkinTone);
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === 'Space') {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedTone(emojiSkinTone);
                            onEmojiSkinToneDefaultChange(emojiSkinTone);
                          }
                        }}
                        title={i18n('icu:EmojiPicker--skin-tone', {
                          tone: `${EMOJI_SKIN_TONE_TO_NUMBER.get(emojiSkinTone)}`,
                        })}
                        className={classNames(
                          'module-emoji-picker__button',
                          'module-emoji-picker__button--footer',
                          selectedTone === emojiSkinTone
                            ? 'module-emoji-picker__button--selected'
                            : null
                        )}
                      >
                        <FunStaticEmoji
                          role="presentation"
                          // Raised Hand
                          emoji={getEmojiVariantByParentKeyAndSkinTone(
                            emojiParentKeyConstant('\u{270B}'),
                            emojiSkinTone
                          )}
                          size={20}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {Boolean(onClickSettings) && (
                <div className="module-emoji-picker__footer__settings-spacer" />
              )}
            </footer>
          </div>
        </FocusScope>
      );
    }
  )
);
