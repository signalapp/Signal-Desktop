// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import FocusTrap from 'focus-trap-react';
import { List } from 'react-virtualized';

import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import type { StickerPackType, StickerType } from '../../state/ducks/stickers';
import type { LocalizerType } from '../../types/Util';
import { getAnalogTime } from '../../util/getAnalogTime';
import { getDateTimeFormatter } from '../../util/formatTimestamp';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly onClose: () => unknown;
  readonly onClickAddPack?: () => unknown;
  readonly onPickSticker: (
    packId: string,
    stickerId: number,
    url: string
  ) => unknown;
  readonly onPickTimeSticker?: (style: 'analog' | 'digital') => unknown;
  readonly packs: ReadonlyArray<StickerPackType>;
  readonly recentStickers: ReadonlyArray<StickerType>;
  readonly showPickerHint?: boolean;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

const PACKS_PAGE_SIZE = 7;
const PACK_ICON_WIDTH = 32;
const PACK_PAGE_WIDTH = PACKS_PAGE_SIZE * PACK_ICON_WIDTH;

const STICKER_HEIGHT = 68;
// 20 in height + 5 in margin-top + 5 in margin-bottom
const RECENTS_HEADER_HEIGHT = 20 + 5 + 5;
const SHOW_TEXT_HEIGHT = 30;
const SHOW_LONG_TEXT_HEIGHT = 60;
// 40 in height + 5 in margin-bottom
const PACK_NAME_HEIGHT = 40 + 5;
const PACK_MARGIN_BOTTOM = 20;
// 20px in margin-bottom
const FEATURED_STICKERS_HEIGHT =
  RECENTS_HEADER_HEIGHT + STICKER_HEIGHT + PACK_MARGIN_BOTTOM;

function getPacksPageOffset(page: number, packs: number): number {
  if (page === 0) {
    return 0;
  }

  if (isLastPacksPage(page, packs)) {
    return (
      PACK_PAGE_WIDTH * (Math.floor(packs / PACKS_PAGE_SIZE) - 1) +
      ((packs % PACKS_PAGE_SIZE) - 1) * PACK_ICON_WIDTH
    );
  }

  return page * PACK_ICON_WIDTH * PACKS_PAGE_SIZE;
}

function isLastPacksPage(page: number, packs: number): boolean {
  return page === Math.floor(packs / PACKS_PAGE_SIZE);
}

export const StickerPicker = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    (
      {
        i18n,
        packs,
        recentStickers,
        onClose,
        onClickAddPack,
        onPickSticker,
        onPickTimeSticker,
        showPickerHint,
        style,
      }: Props,
      ref
    ) => {
      // The index of the pack we're browsing (whether by
      // scrolling to it, or clicking on it) on the virtualized list.
      // 0 is the index for the recent/feature stickers element.
      const [selectedPackIndex, setSelectedPackIndex] = React.useState(0);

      const isRTL = i18n.getLocaleDirection() === 'rtl';

      const [isUsingKeyboard, setIsUsingKeyboard] = React.useState(false);
      const [packsPage, setPacksPage] = React.useState(0);
      const onClickPrevPackPage = React.useCallback(() => {
        setPacksPage(i => i - 1);
      }, [setPacksPage]);
      const onClickNextPackPage = React.useCallback(() => {
        setPacksPage(i => i + 1);
      }, [setPacksPage]);

      const packDownloadInfo = React.useCallback((pack: StickerPackType) => {
        const pendingCount =
          pack && pack.status === 'pending'
            ? pack.stickerCount - pack.stickers.length
            : 0;

        const hasDownloadError =
          pack &&
          pack.status === 'error' &&
          pack.stickerCount !== pack.stickers.length;

        const showPendingText = pendingCount > 0;
        const showEmptyText =
          pack && !hasDownloadError && pack.stickerCount === 0;
        const showText = showPendingText || hasDownloadError || showEmptyText;

        return [
          showText,
          showPendingText,
          pendingCount,
          showEmptyText,
          hasDownloadError,
        ];
      }, []);

      const hasPacks = packs.length > 0;
      const hasRecents = recentStickers.length > 0;
      const isRecentsSelected = hasPacks && selectedPackIndex === 0;

      const hasTimeStickers = isRecentsSelected && onPickTimeSticker;
      const isEmpty = !hasPacks && !hasTimeStickers && !hasRecents;

      const rowHeight = React.useCallback(
        ({ index }: { index: number }) => {
          const isRecents = index === 0;

          if (isRecents && !hasRecents && !hasTimeStickers) {
            return 0;
          }

          const isLastPack = !isRecents && index === packs.length;
          const stickerCount = isRecents
            ? recentStickers.length
            : packs[index - 1].stickers.length;

          const [showText] = packDownloadInfo(packs[index - 1]);

          const rows = Math.ceil(stickerCount / 4);

          // Extra height can be needed to render pending downloads or errors
          const showTextHeight = !isRecents && showText ? SHOW_TEXT_HEIGHT : 0;

          const showHintHeight =
            isRecents && showPickerHint ? SHOW_LONG_TEXT_HEIGHT : 0;

          const recentStickersHeaderHeight =
            (hasRecents ? RECENTS_HEADER_HEIGHT : 0) +
            (hasTimeStickers ? FEATURED_STICKERS_HEIGHT : 0) +
            showHintHeight;

          const packHeaderHeight = isRecents
            ? recentStickersHeaderHeight
            : PACK_NAME_HEIGHT;

          const packGridHeight = STICKER_HEIGHT * rows;
          const packBottomMargin =
            !isLastPack || (isRecents && hasRecents) ? PACK_MARGIN_BOTTOM : 0;
          // We have to consider 8px padding in between each row
          const packGridPadding = 8 * (rows - 1) + packBottomMargin;

          return (
            packHeaderHeight + showTextHeight + packGridHeight + packGridPadding
          );
        },
        [
          recentStickers,
          packs,
          showPickerHint,
          hasRecents,
          hasTimeStickers,
          packDownloadInfo,
        ]
      );

      // Handle escape key
      React.useEffect(() => {
        const handler = (event: KeyboardEvent) => {
          if (event.key === 'Tab') {
            // We do NOT prevent default here to allow Tab to be used normally

            setIsUsingKeyboard(true);

            return;
          }

          if (event.key === 'Escape') {
            event.stopPropagation();
            event.preventDefault();

            onClose();
          }
        };

        document.addEventListener('keydown', handler);

        return () => {
          document.removeEventListener('keydown', handler);
        };
      }, [onClose]);

      // Focus popup on after initial render, restore focus on teardown
      const [focusRef] = useRestoreFocus();

      const addPackRef = isEmpty ? focusRef : undefined;

      const listRef = React.createRef<List>();

      // Computing the entire list height when rendering
      // (or after new packs are added) is important to get
      // an accurate scroll offset and scrollbar length
      React.useEffect(() => {
        if (listRef.current) {
          listRef.current.measureAllRows();
        }
        // We don't want to have listRef as a dependency because
        // it updates too much and `measureAllRows()` is an expensive
        // operation. The only thing that can affect row height is newly
        // downloaded packs, so `packs.length` is enough
        //
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [packs.length]);

      const renderStickerGrid = React.useCallback(
        (packTitle: string, stickerList: ReadonlyArray<StickerType>) =>
          stickerList.map(sticker => (
            <button
              type="button"
              key={`${sticker.packId}-${sticker.id}`}
              className="module-sticker-picker__body__cell"
              onClick={() =>
                onPickSticker(sticker.packId, sticker.id, sticker.url)
              }
            >
              <img
                className="module-sticker-picker__body__cell__image"
                src={sticker.url}
                width={STICKER_HEIGHT}
                height={STICKER_HEIGHT}
                alt={`${packTitle} ${sticker.emoji}`}
              />
            </button>
          )),
        [onPickSticker]
      );

      const rowRenderer = React.useCallback(
        ({
          index,
          key: listKey,
          style: listStyle,
        }: {
          index: number;
          key: string;
          style: React.CSSProperties;
        }) => {
          const analogTime = getAnalogTime();

          // Recents and/or featured stickers are at special index 0.
          if (index === 0) {
            const featuredStickerElement = hasTimeStickers && (
              <div className="module-sticker-picker__featured">
                <h3 className="module-sticker-picker__featured--title">
                  {i18n('icu:stickers__StickerPicker__featured')}
                </h3>
                <div className="module-sticker-picker__body__grid">
                  <button
                    type="button"
                    className="module-sticker-picker__body__cell module-sticker-picker__time--digital"
                    onClick={() => onPickTimeSticker('digital')}
                  >
                    {getDateTimeFormatter({
                      hour: 'numeric',
                      minute: 'numeric',
                    })
                      .formatToParts(Date.now())
                      .filter(x => x.type !== 'dayPeriod')
                      .reduce((acc, { value }) => `${acc}${value}`, '')}
                  </button>

                  <button
                    aria-label={i18n(
                      'icu:stickers__StickerPicker__analog-time'
                    )}
                    className="module-sticker-picker__body__cell module-sticker-picker__time--analog"
                    onClick={() => onPickTimeSticker('analog')}
                    type="button"
                  >
                    <span
                      className="module-sticker-picker__time--analog__hour"
                      style={{
                        transform: `rotate(${analogTime.hour}deg)`,
                      }}
                    />
                    <span
                      className="module-sticker-picker__time--analog__minute"
                      style={{
                        transform: `rotate(${analogTime.minute}deg)`,
                      }}
                    />
                  </button>
                </div>
              </div>
            );

            const recentsPackTitle = i18n(
              'icu:stickers__StickerPicker__recent'
            );
            const recentStickersElement = hasRecents && (
              <>
                <div
                  className={classNames(
                    'module-sticker-picker__pack-title',
                    'module-sticker-picker__pack-title__recents'
                  )}
                >
                  <h3>{recentsPackTitle}</h3>
                </div>
                <div className="module-sticker-picker__body__grid">
                  {renderStickerGrid(recentsPackTitle, recentStickers)}
                </div>
              </>
            );

            return (
              <div key={listKey} style={listStyle}>
                {showPickerHint ? (
                  <div
                    className={classNames(
                      'module-sticker-picker__body__text',
                      'module-sticker-picker__body__text--hint'
                    )}
                  >
                    {i18n('icu:stickers--StickerPicker--Hint')}
                  </div>
                ) : null}
                {featuredStickerElement}
                {recentStickersElement}
              </div>
            );
          }

          const selectedPack = packs[index - 1];
          const [
            ,
            pendingCount,
            showPendingText,
            showEmptyText,
            hasDownloadError,
          ] = packDownloadInfo(selectedPack);

          return (
            <div key={listKey} style={listStyle}>
              <div className="module-sticker-picker__pack-title">
                <h3>{selectedPack.title}</h3>
                <i>{selectedPack.author}</i>
              </div>
              {showPendingText ? (
                <div className="module-sticker-picker__body__text">
                  {i18n('icu:stickers--StickerPicker--DownloadPending')}
                </div>
              ) : null}
              {hasDownloadError && selectedPack.stickers.length > 0 ? (
                <div
                  className={classNames(
                    'module-sticker-picker__body__text',
                    'module-sticker-picker__body__text--error'
                  )}
                >
                  {i18n('icu:stickers--StickerPicker--DownloadError')}
                </div>
              ) : null}
              {hasPacks && showEmptyText ? (
                <div
                  className={classNames('module-sticker-picker__body__text', {
                    'module-sticker-picker__body__text--error':
                      !isRecentsSelected,
                  })}
                >
                  {i18n('icu:stickers--StickerPicker--Empty')}
                </div>
              ) : null}
              <div className="module-sticker-picker__body__grid">
                {renderStickerGrid(selectedPack.title, selectedPack.stickers)}
                {showPendingText
                  ? Array(pendingCount)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          // eslint-disable-next-line react/no-array-index-key
                          key={`${listKey}-${i}`}
                          className="module-sticker-picker__body__cell__placeholder"
                          role="presentation"
                        />
                      ))
                  : null}
              </div>
            </div>
          );
        },
        [
          recentStickers,
          packs,
          showPickerHint,
          hasPacks,
          hasRecents,
          hasTimeStickers,
          isRecentsSelected,
          i18n,
          onPickTimeSticker,
          packDownloadInfo,
          renderStickerGrid,
        ]
      );

      const onRowsRendered = React.useCallback(
        ({ startIndex }: { startIndex: number }) => {
          if (startIndex === 0) {
            setPacksPage(0);
          } else if (startIndex > 0 && selectedPackIndex > 0) {
            // If we're on a new page, we're on a new multiple of PACKS_PAGE_SIZE
            // (because there are PACKS_PAGE_SIZE stickers per page)
            //
            // The indexes have an offset of 1 because of recent stickers at index 0.
            const newPage = Math.floor((startIndex - 1) / PACKS_PAGE_SIZE);
            const oldPage = Math.floor(
              (selectedPackIndex - 1) / PACKS_PAGE_SIZE
            );
            const pageDiff = newPage - oldPage;

            if (
              packsPage !== newPage ||
              (pageDiff > 0 && !isLastPacksPage(packsPage, packs.length)) ||
              (pageDiff < 0 && packsPage > 0)
            ) {
              setPacksPage(newPage);
            }
          }

          setSelectedPackIndex(startIndex);
        },
        [
          packsPage,
          setPacksPage,
          selectedPackIndex,
          setSelectedPackIndex,
          packs.length,
        ]
      );

      const noRowsRenderer = React.useCallback(() => {
        return (
          <div className="module-sticker-picker__body__text">
            {i18n('icu:stickers--StickerPicker--NoPacks')}
          </div>
        );
      }, [i18n]);

      return (
        <FocusTrap
          focusTrapOptions={{
            allowOutsideClick: true,
          }}
        >
          <div className="module-sticker-picker" ref={ref} style={style}>
            <div className="module-sticker-picker__header">
              <div className="module-sticker-picker__header__packs">
                <div
                  className="module-sticker-picker__header__packs__slider"
                  style={{
                    transform: `translateX(${isRTL ? '' : '-'}${getPacksPageOffset(
                      packsPage,
                      packs.length
                    )}px)`,
                  }}
                >
                  <button
                    aria-pressed={isRecentsSelected}
                    type="button"
                    onClick={() => {
                      listRef.current?.scrollToRow(0);
                    }}
                    className={classNames({
                      'module-sticker-picker__header__button': true,
                      'module-sticker-picker__header__button--recents': true,
                      'module-sticker-picker__header__button--selected':
                        isRecentsSelected,
                    })}
                    aria-label={i18n('icu:stickers--StickerPicker--Recents')}
                  />
                  {packs.map((pack, i) => {
                    // Since recent stickers at at row 0,
                    // we have to offset by 1 to get the pack index
                    const packIndex = i + 1;

                    return (
                      <button
                        aria-pressed={selectedPackIndex === packIndex}
                        type="button"
                        key={pack.id}
                        onClick={() => {
                          if (listRef.current) {
                            // scrollToRow has floating point issues so onRowRendered can
                            // end up returning the wrong rows if the user has fractional
                            // scaling or app zoom (ask how I know...)
                            //
                            // So we add an epsilon value to the computed row position and
                            // scroll that amount instead. 1 pixel extra is invisible and
                            // ensures the problem goes away for good
                            const positionEpsilon = 1.0;

                            const packPosition =
                              listRef.current.getOffsetForRow({
                                alignment: 'start',
                                index: packIndex,
                              }) + positionEpsilon;

                            listRef.current.scrollToPosition(packPosition);
                          }
                        }}
                        className={classNames(
                          'module-sticker-picker__header__button',
                          {
                            'module-sticker-picker__header__button--selected':
                              selectedPackIndex === packIndex,
                            'module-sticker-picker__header__button--error':
                              pack.status === 'error',
                          }
                        )}
                      >
                        {pack.cover ? (
                          <img
                            className="module-sticker-picker__header__button__image"
                            src={pack.cover.url}
                            alt={pack.title}
                            title={pack.title}
                          />
                        ) : (
                          <div className="module-sticker-picker__header__button__image-placeholder" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {!isUsingKeyboard && packsPage > 0 ? (
                  <button
                    type="button"
                    className={classNames(
                      'module-sticker-picker__header__button',
                      'module-sticker-picker__header__button--prev-page'
                    )}
                    onClick={onClickPrevPackPage}
                    aria-label={i18n('icu:stickers--StickerPicker--PrevPage')}
                  />
                ) : null}
                {!isUsingKeyboard &&
                !isLastPacksPage(packsPage, packs.length) ? (
                  <button
                    type="button"
                    className={classNames(
                      'module-sticker-picker__header__button',
                      'module-sticker-picker__header__button--next-page'
                    )}
                    onClick={onClickNextPackPage}
                    aria-label={i18n('icu:stickers--StickerPicker--NextPage')}
                  />
                ) : null}
              </div>
              {onClickAddPack && (
                <button
                  type="button"
                  ref={addPackRef}
                  className={classNames(
                    'module-sticker-picker__header__button',
                    'module-sticker-picker__header__button--add-pack',
                    {
                      'module-sticker-picker__header__button--hint':
                        showPickerHint,
                    }
                  )}
                  onClick={onClickAddPack}
                  aria-label={i18n('icu:stickers--StickerPicker--AddPack')}
                />
              )}
            </div>
            <div
              className={classNames('module-sticker-picker__body', {
                'module-sticker-picker__body--empty': isEmpty,
              })}
            >
              <div className="module-sticker-picker__body__content">
                <List
                  width={316}
                  height={344}
                  ref={listRef}
                  style={{
                    direction: isRTL ? 'rtl' : 'ltr',
                  }}
                  scrollToAlignment="start"
                  noRowsRenderer={noRowsRenderer}
                  // Even if there are no recent stickers,
                  // there is always a row offset of 1
                  rowCount={isEmpty ? 0 : packs.length + 1}
                  rowHeight={rowHeight}
                  rowRenderer={rowRenderer}
                  overscanRowCount={0}
                  onRowsRendered={onRowsRendered}
                />
              </div>
            </div>
          </div>
        </FocusTrap>
      );
    }
  )
);
