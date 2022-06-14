// Copyright 2019-2022 Signal Messenger, LLC
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
import FocusTrap from 'focus-trap-react';

import { Emoji } from './Emoji';
import { dataByCategory, search } from './lib';
import type { LocalizerType } from '../../types/Util';

export type EmojiPickDataType = {
  skinTone?: number;
  shortName: string;
};

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly onPickEmoji: (o: EmojiPickDataType) => unknown;
  readonly doSend?: () => unknown;
  readonly skinTone?: number;
  readonly onSetSkinTone?: (tone: number) => unknown;
  readonly recentEmojis?: Array<string>;
  readonly onClickSettings?: () => unknown;
  readonly onClose?: () => unknown;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

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
];

export const EmojiPicker = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    (
      {
        i18n,
        doSend,
        onPickEmoji,
        skinTone = 0,
        onSetSkinTone,
        recentEmojis = [],
        style,
        onClickSettings,
        onClose,
      }: Props,
      ref
    ) => {
      const [firstRecent] = React.useState(recentEmojis);
      const [selectedCategory, setSelectedCategory] = React.useState(
        categories[0]
      );
      const [searchMode, setSearchMode] = React.useState(false);
      const [searchText, setSearchText] = React.useState('');
      const [scrollToRow, setScrollToRow] = React.useState(0);
      const [selectedTone, setSelectedTone] = React.useState(skinTone);

      const handleToggleSearch = React.useCallback(
        (e: React.MouseEvent) => {
          e.stopPropagation();
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

      const handlePickTone = React.useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          e.stopPropagation();

          const { tone = '0' } = e.currentTarget.dataset;
          const parsedTone = parseInt(tone, 10);
          setSelectedTone(parsedTone);
          if (onSetSkinTone) {
            onSetSkinTone(parsedTone);
          }
        },
        [onSetSkinTone]
      );

      const handlePickEmoji = React.useCallback(
        (
          e:
            | React.MouseEvent<HTMLButtonElement>
            | React.KeyboardEvent<HTMLButtonElement>
        ) => {
          if ('key' in e) {
            if (e.key === 'Enter' && doSend) {
              e.stopPropagation();
              e.preventDefault();
              doSend();
            }
          } else {
            const { shortName } = e.currentTarget.dataset;
            if (shortName) {
              e.stopPropagation();
              e.preventDefault();
              onPickEmoji({ skinTone: selectedTone, shortName });
            }
          }
        },
        [doSend, onPickEmoji, selectedTone]
      );

      // Handle escape key
      React.useEffect(() => {
        const handler = (event: KeyboardEvent) => {
          if (searchMode && event.key === 'Escape') {
            setScrollToRow(0);
            setSearchText('');
            setSearchMode(false);

            event.preventDefault();
            event.stopPropagation();
          } else if (
            !searchMode &&
            !event.ctrlKey &&
            ![
              'ArrowUp',
              'ArrowDown',
              'ArrowLeft',
              'ArrowRight',
              'Shift',
              'Tab',
              ' ', // Space
            ].includes(event.key)
          ) {
            if (onClose) {
              onClose();
            }

            event.preventDefault();
            event.stopPropagation();
          }
        };

        document.addEventListener('keydown', handler);

        return () => {
          document.removeEventListener('keydown', handler);
        };
      }, [onClose, searchMode]);

      const [, ...renderableCategories] = categories;

      const emojiGrid = React.useMemo(() => {
        if (searchText) {
          return chunk(
            search(searchText).map(e => e.short_name),
            COL_COUNT
          );
        }

        const chunks = flatMap(renderableCategories, cat =>
          chunk(
            dataByCategory[cat].map(e => e.short_name),
            COL_COUNT
          )
        );

        return [...chunk(firstRecent, COL_COUNT), ...chunks];
      }, [firstRecent, renderableCategories, searchText]);

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
        (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          const { category } = e.currentTarget.dataset;
          if (category) {
            setSelectedCategory(category);
            setScrollToRow(catToRowOffsets[category]);
          }
        },
        [catToRowOffsets, setSelectedCategory, setScrollToRow]
      );

      const cellRenderer = React.useCallback<GridCellRenderer>(
        ({ key, style: cellStyle, rowIndex, columnIndex }) => {
          const shortName = emojiGrid[rowIndex][columnIndex];

          return shortName ? (
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
                <Emoji shortName={shortName} skinTone={selectedTone} />
              </button>
            </div>
          ) : null;
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

            setSelectedCategory(cat);
          }, 10),
        [catOffsetEntries]
      );

      return (
        <FocusTrap
          focusTrapOptions={{
            allowOutsideClick: true,
          }}
        >
          <div className="module-emoji-picker" ref={ref} style={style}>
            <header className="module-emoji-picker__header">
              <button
                type="button"
                onClick={handleToggleSearch}
                title={i18n('EmojiPicker--search-placeholder')}
                className={classNames(
                  'module-emoji-picker__button',
                  'module-emoji-picker__button--icon',
                  searchMode
                    ? 'module-emoji-picker__button--icon--close'
                    : 'module-emoji-picker__button--icon--search'
                )}
                aria-label={i18n('EmojiPicker--search-placeholder')}
              />
              {searchMode ? (
                <div className="module-emoji-picker__header__search-field">
                  <input
                    ref={focusOnRender}
                    className="module-emoji-picker__header__search-field__input"
                    placeholder={i18n('EmojiPicker--search-placeholder')}
                    onChange={handleSearchChange}
                  />
                </div>
              ) : (
                categories.map(cat =>
                  cat === 'recents' && firstRecent.length === 0 ? null : (
                    <button
                      type="button"
                      key={cat}
                      data-category={cat}
                      title={cat}
                      onClick={handleSelectCategory}
                      className={classNames(
                        'module-emoji-picker__button',
                        'module-emoji-picker__button--icon',
                        `module-emoji-picker__button--icon--${cat}`,
                        selectedCategory === cat
                          ? 'module-emoji-picker__button--selected'
                          : null
                      )}
                      aria-label={i18n(`EmojiPicker__button--${cat}`)}
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
                {i18n('EmojiPicker--empty')}
                <Emoji
                  shortName="slightly_frowning_face"
                  size={16}
                  style={{ marginLeft: '4px' }}
                />
              </div>
            )}
            <footer className="module-emoji-picker__footer">
              {Boolean(onClickSettings) && (
                <button
                  aria-label={i18n('CustomizingPreferredReactions__title')}
                  className="module-emoji-picker__button module-emoji-picker__button--footer module-emoji-picker__button--settings"
                  onClick={onClickSettings}
                  title={i18n('CustomizingPreferredReactions__title')}
                  type="button"
                />
              )}
              {onSetSkinTone ? (
                <div className="module-emoji-picker__footer__skin-tones">
                  {[0, 1, 2, 3, 4, 5].map(tone => (
                    <button
                      type="button"
                      key={tone}
                      data-tone={tone}
                      onClick={handlePickTone}
                      title={i18n('EmojiPicker--skin-tone', [`${tone}`])}
                      className={classNames(
                        'module-emoji-picker__button',
                        'module-emoji-picker__button--footer',
                        selectedTone === tone
                          ? 'module-emoji-picker__button--selected'
                          : null
                      )}
                    >
                      <Emoji shortName="hand" skinTone={tone} size={20} />
                    </button>
                  ))}
                </div>
              ) : null}
              {Boolean(onClickSettings) && (
                <div className="module-emoji-picker__footer__settings-spacer" />
              )}
            </footer>
          </div>
        </FocusTrap>
      );
    }
  )
);
