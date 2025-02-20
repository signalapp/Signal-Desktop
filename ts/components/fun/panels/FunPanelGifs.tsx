// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Range } from '@tanstack/react-virtual';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import type { MouseEvent } from 'react';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { VisuallyHidden } from 'react-aria';
import { LRUCache } from 'lru-cache';
import { FunItemButton, FunItemGif } from '../base/FunItem';
import { FunPanel } from '../base/FunPanel';
import { FunScroller } from '../base/FunScroller';
import { FunSearch } from '../base/FunSearch';
import {
  FunSubNav,
  FunSubNavIcon,
  FunSubNavListBox,
  FunSubNavListBoxItem,
} from '../base/FunSubNav';
import { FunWaterfallContainer, FunWaterfallItem } from '../base/FunWaterfall';
import type { FunGifsSection } from '../FunConstants';
import { FunGifsCategory, FunSectionCommon } from '../FunConstants';
import { FunKeyboard } from '../keyboard/FunKeyboard';
import type { WaterfallKeyboardState } from '../keyboard/WaterfallKeyboardDelegate';
import { WaterfallKeyboardDelegate } from '../keyboard/WaterfallKeyboardDelegate';
import { useInfiniteQuery } from '../data/infinite';
import { missingCaseError } from '../../../util/missingCaseError';
import { strictAssert } from '../../../util/assert';
import type { GifsPaginated } from '../data/gifs';
import { fetchFeatured, fetchSearch } from '../data/gifs';
import { drop } from '../../../util/drop';
import { tenorDownload } from '../data/tenor';
import { useFunContext } from '../FunProvider';
import {
  FunResults,
  FunResultsButton,
  FunResultsFigure,
  FunResultsHeader,
  FunResultsSpinner,
} from '../base/FunResults';
import { FunEmoji } from '../FunEmoji';
import { emojiVariantConstant } from '../data/emojis';

const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 MB
const FunGifBlobCache = new LRUCache<string, Blob>({
  maxSize: MAX_CACHE_SIZE,
  sizeCalculation: blob => blob.size,
});
const FunGifBlobLiveCache = new WeakMap<GifMediaType, Blob>();

function readGifMediaFromCache(gifMedia: GifMediaType): Blob | null {
  return (
    FunGifBlobLiveCache.get(gifMedia) ??
    FunGifBlobCache.get(gifMedia.url) ??
    null
  );
}

function saveGifMediaToCache(gifMedia: GifMediaType, blob: Blob): void {
  FunGifBlobCache.set(gifMedia.url, blob);
  FunGifBlobLiveCache.set(gifMedia, blob);
}

const GIF_WATERFALL_COLUMNS = 2;
const GIF_WATERFALL_ITEM_WIDTH = 160;
const GIF_WATERFALL_ITEM_MARGIN = 2;
const GIF_WATERFALL_ITEM_TOTAL_WIDTH =
  GIF_WATERFALL_ITEM_WIDTH +
  GIF_WATERFALL_ITEM_MARGIN +
  GIF_WATERFALL_ITEM_MARGIN;

export type GifMediaType = Readonly<{
  url: string;
  width: number;
  height: number;
}>;

export type GifType = Readonly<{
  id: string;
  title: string;
  description: string;
  previewMedia: GifMediaType;
  attachmentMedia: GifMediaType;
}>;

type GifsQuery = Readonly<{
  selectedSection: FunGifsSection;
  searchQuery: string;
}>;

export type FunGifSelection = Readonly<{
  attachmentMedia: GifMediaType;
}>;

export type FunPanelGifsProps = Readonly<{
  onSelectGif: (gifSelection: FunGifSelection) => void;
  onClose: () => void;
}>;

export function FunPanelGifs({
  onSelectGif,
  onClose,
}: FunPanelGifsProps): JSX.Element {
  const fun = useFunContext();
  const {
    i18n,
    searchInput,
    onSearchInputChange,
    selectedGifsSection,
    onChangeSelectedSelectGifsSection,
    recentGifs,
  } = fun;

  const scrollerRef = useRef<HTMLDivElement>(null);

  const searchQuery = useMemo(() => searchInput.trim(), [searchInput]);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  const handleSearchInputChange = useCallback(
    (nextSearchInput: string) => {
      if (nextSearchInput.trim() !== '') {
        onChangeSelectedSelectGifsSection(FunSectionCommon.SearchResults);
      } else if (recentGifs.length > 0) {
        onChangeSelectedSelectGifsSection(FunSectionCommon.Recents);
      } else {
        onChangeSelectedSelectGifsSection(FunGifsCategory.Trending);
      }
      onSearchInputChange(nextSearchInput);
    },
    [onSearchInputChange, recentGifs, onChangeSelectedSelectGifsSection]
  );

  const [debouncedQuery, setDebouncedQuery] = useState<GifsQuery>({
    selectedSection: selectedGifsSection,
    searchQuery,
  });

  useEffect(() => {
    const query: GifsQuery = {
      selectedSection: selectedGifsSection,
      searchQuery,
    };
    // Set immediately if not a search
    if (searchQuery === '') {
      setDebouncedQuery(query);
      return;
    }
    // Defer searches
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => {
      clearTimeout(timeout);
    };
  }, [searchQuery, selectedGifsSection]);

  const loader = useCallback(
    async (
      query: GifsQuery,
      previousPage: GifsPaginated | null,
      signal: AbortSignal
    ) => {
      const cursor = previousPage?.next ?? null;
      const limit = cursor != null ? 30 : 10;

      if (query.searchQuery !== '') {
        return fetchSearch(query.searchQuery, limit, cursor, signal);
      }
      strictAssert(
        query.selectedSection !== FunSectionCommon.SearchResults,
        'Section is search results when not searching'
      );
      if (query.selectedSection === FunSectionCommon.Recents) {
        return { next: null, gifs: recentGifs };
      }
      if (query.selectedSection === FunGifsCategory.Trending) {
        return fetchFeatured(limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Celebrate) {
        return fetchSearch('celebrate', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Love) {
        return fetchSearch('love', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.ThumbsUp) {
        return fetchSearch('thumbs-up', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Surprised) {
        return fetchSearch('surprised', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Excited) {
        return fetchSearch('excited', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Sad) {
        return fetchSearch('sad', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Angry) {
        return fetchSearch('angry', limit, cursor, signal);
      }

      throw missingCaseError(query.selectedSection);
    },
    [recentGifs]
  );

  const hasNextPage = useCallback(
    (_query: GifsQuery, previousPage: GifsPaginated | null) => {
      return previousPage?.next != null;
    },
    []
  );

  const { queryState, fetchNextPage, revalidate } = useInfiniteQuery({
    query: debouncedQuery,
    loader,
    hasNextPage,
  });

  const items = useMemo(() => {
    return queryState.pages.flatMap(page => page.gifs);
  }, [queryState.pages]);

  const estimateSize = useCallback(
    (index: number) => {
      const gif = items[index];
      const aspectRatio = gif.previewMedia.width / gif.previewMedia.height;
      const baseHeight = GIF_WATERFALL_ITEM_WIDTH / aspectRatio;
      return baseHeight + GIF_WATERFALL_ITEM_MARGIN + GIF_WATERFALL_ITEM_MARGIN;
    },
    [items]
  );

  const count = items.length;

  // Override the range extractor to always include the first and last indexes
  // so the keyboard delegate has something to jump to.
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      if (!indexes.includes(0)) {
        indexes.unshift(0); // always include first
      }
      if (!indexes.includes(count - 1)) {
        indexes.push(count - 1); // always include last
      }
      return indexes;
    },
    [count]
  );

  const getScrollElement = useCallback(() => {
    return scrollerRef.current;
  }, []);

  const getItemKey = useCallback(
    (index: number) => {
      return items[index].id;
    },
    [items]
  );

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count,
    getScrollElement,
    estimateSize,
    rangeExtractor,
    overscan: 4 * GIF_WATERFALL_COLUMNS,
    lanes: GIF_WATERFALL_COLUMNS,
    scrollPaddingStart: 20,
    scrollPaddingEnd: 20,
    getItemKey,
  });

  // Scroll back to top when query changes
  useEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [queryState.query, virtualizer]);

  const lastIndex = virtualizer.range?.endIndex ?? -1;

  useEffect(() => {
    if (
      lastIndex === -1 ||
      count === 0 ||
      !queryState.hasNextPage ||
      queryState.pending
    ) {
      return;
    }

    const overscan = 4 * GIF_WATERFALL_COLUMNS;

    // if we're near the end of the list, fetch more
    if (lastIndex + overscan >= count - 1) {
      fetchNextPage();
    }
  }, [
    lastIndex,
    count,
    queryState.hasNextPage,
    queryState.pending,
    fetchNextPage,
  ]);

  const keyboard = useMemo(() => {
    return new WaterfallKeyboardDelegate(virtualizer);
  }, [virtualizer]);

  const handleSelectSection = useCallback(
    (key: string) => {
      onChangeSelectedSelectGifsSection(key as FunGifsCategory);
    },
    [onChangeSelectedSelectGifsSection]
  );

  const handleKeyboardStateChange = useCallback(
    (state: WaterfallKeyboardState) => {
      setSelectedItemKey(state.key);
    },
    []
  );

  const handlePressGif = useCallback(
    (event: MouseEvent, gifSelection: FunGifSelection) => {
      onSelectGif(gifSelection);
      if (!(event.ctrlKey || event.metaKey)) {
        onClose();
      }
    },
    [onSelectGif, onClose]
  );

  const handleRetry = useCallback(() => {
    revalidate();
  }, [revalidate]);

  // When we're searching, wait until the pending query is updated before
  // changing the UI
  const visibleSelectedSection =
    debouncedQuery.selectedSection === FunSectionCommon.SearchResults
      ? queryState.query.selectedSection
      : debouncedQuery.selectedSection;

  return (
    <FunPanel>
      <FunSearch
        searchInput={searchInput}
        onSearchInputChange={handleSearchInputChange}
        placeholder={i18n('icu:FunPanelGifs__SearchPlaceholder--Tenor')}
        aria-label={i18n('icu:FunPanelGifs__SearchLabel--Tenor')}
      />
      {visibleSelectedSection !== FunSectionCommon.SearchResults && (
        <FunSubNav>
          <FunSubNavListBox
            aria-label={i18n('icu:FunPanelGifs__SubNavLabel')}
            selected={visibleSelectedSection}
            onSelect={handleSelectSection}
          >
            {recentGifs.length > 0 && (
              <FunSubNavListBoxItem
                id={FunSectionCommon.Recents}
                label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Recents')}
              >
                <FunSubNavIcon iconClassName="FunSubNav__Icon--Recents" />
              </FunSubNavListBoxItem>
            )}
            <FunSubNavListBoxItem
              id={FunGifsCategory.Trending}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Trending')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--Trending" />
            </FunSubNavListBoxItem>
            <FunSubNavListBoxItem
              id={FunGifsCategory.Celebrate}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Celebrate')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--Celebrate" />
            </FunSubNavListBoxItem>
            <FunSubNavListBoxItem
              id={FunGifsCategory.Love}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Love')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--Love" />
            </FunSubNavListBoxItem>
            <FunSubNavListBoxItem
              id={FunGifsCategory.ThumbsUp}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--ThumbsUp')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--ThumbsUp" />
            </FunSubNavListBoxItem>
            <FunSubNavListBoxItem
              id={FunGifsCategory.Surprised}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Surprised')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--Surprised" />
            </FunSubNavListBoxItem>
            <FunSubNavListBoxItem
              id={FunGifsCategory.Excited}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Excited')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--Excited" />
            </FunSubNavListBoxItem>
            <FunSubNavListBoxItem
              id={FunGifsCategory.Sad}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Sad')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--Sad" />
            </FunSubNavListBoxItem>
            <FunSubNavListBoxItem
              id={FunGifsCategory.Angry}
              label={i18n('icu:FunPanelGifs__SubNavCategoryLabel--Angry')}
            >
              <FunSubNavIcon iconClassName="FunSubNav__Icon--Angry" />
            </FunSubNavListBoxItem>
          </FunSubNavListBox>
        </FunSubNav>
      )}
      <FunScroller ref={scrollerRef} sectionGap={0}>
        {count === 0 && (
          <FunResults aria-busy={queryState.pending}>
            {queryState.pending && (
              <>
                <FunResultsFigure>
                  <FunResultsSpinner />
                </FunResultsFigure>
                <VisuallyHidden>
                  <FunResultsHeader>
                    {i18n('icu:FunPanelGifs__SearchResults__LoadingLabel')}
                  </FunResultsHeader>
                </VisuallyHidden>
              </>
            )}
            {queryState.rejected && (
              <>
                <FunResultsHeader>
                  {i18n('icu:FunPanelGifs__SearchResults__ErrorHeading')}
                </FunResultsHeader>
                <FunResultsButton onPress={handleRetry}>
                  {i18n('icu:FunPanelGifs__SearchResults__ErrorRetryButton')}
                </FunResultsButton>
              </>
            )}
            {!queryState.pending && !queryState.rejected && (
              <FunResultsHeader>
                {i18n('icu:FunPanelGifs__SearchResults__EmptyHeading')}{' '}
                <FunEmoji
                  size={16}
                  role="presentation"
                  // For presentation only
                  aria-label=""
                  emoji={emojiVariantConstant('\u{1F641}')}
                />
              </FunResultsHeader>
            )}
          </FunResults>
        )}
        {count !== 0 && (
          <FunKeyboard
            scrollerRef={scrollerRef}
            keyboard={keyboard}
            onStateChange={handleKeyboardStateChange}
          >
            <FunWaterfallContainer totalSize={virtualizer.getTotalSize()}>
              {virtualizer.getVirtualItems().map(item => {
                const gif = items[item.index];
                const key = String(item.key);
                const isTabbable =
                  selectedItemKey != null
                    ? key === selectedItemKey
                    : item.index === 0;
                return (
                  <Item
                    key={key}
                    gif={gif}
                    itemKey={key}
                    itemHeight={item.size}
                    itemOffset={item.start}
                    itemLane={item.lane}
                    isTabbable={isTabbable}
                    onPressGif={handlePressGif}
                  />
                );
              })}
            </FunWaterfallContainer>
          </FunKeyboard>
        )}
      </FunScroller>
    </FunPanel>
  );
}

const Item = memo(function Item(props: {
  gif: GifType;
  itemKey: string;
  itemHeight: number;
  itemOffset: number;
  itemLane: number;
  isTabbable: boolean;
  onPressGif: (event: MouseEvent, gifSelection: FunGifSelection) => void;
}) {
  const { onPressGif } = props;
  const handleClick = useCallback(
    async (event: MouseEvent) => {
      onPressGif(event, {
        attachmentMedia: props.gif.attachmentMedia,
      });
    },
    [props.gif, onPressGif]
  );
  const descriptionId = `FunGifsPanelItem__GifDescription--${props.gif.id}`;
  const [src, setSrc] = useState<string | null>(() => {
    const cached = readGifMediaFromCache(props.gif.previewMedia);
    return cached != null ? URL.createObjectURL(cached) : null;
  });

  useEffect(() => {
    if (src != null) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    async function download() {
      const bytes = await tenorDownload(props.gif.previewMedia.url, signal);
      const blob = new Blob([bytes]);
      saveGifMediaToCache(props.gif.previewMedia, blob);
      setSrc(URL.createObjectURL(blob));
    }

    drop(download());

    return () => {
      controller.abort();
    };
  }, [props.gif, src]);

  useEffect(() => {
    return () => {
      if (src != null) {
        URL.revokeObjectURL(src);
      }
    };
  }, [src]);

  return (
    <FunWaterfallItem
      data-key={props.itemKey}
      width={GIF_WATERFALL_ITEM_TOTAL_WIDTH}
      height={props.itemHeight}
      offsetY={props.itemOffset}
      offsetX={GIF_WATERFALL_ITEM_TOTAL_WIDTH * props.itemLane}
    >
      <FunItemButton
        aria-label={props.gif.title}
        aria-describedby={descriptionId}
        onClick={handleClick}
        tabIndex={props.isTabbable ? 0 : -1}
      >
        {src != null && (
          <FunItemGif
            src={src}
            width={props.gif.previewMedia.width}
            height={props.gif.previewMedia.height}
          />
        )}
        <VisuallyHidden id={descriptionId}>
          {props.gif.description}
        </VisuallyHidden>
      </FunItemButton>
    </FunWaterfallItem>
  );
});
