// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Range } from '@tanstack/react-virtual';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import type { PointerEvent } from 'react';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from 'react';
import { VisuallyHidden } from 'react-aria';
import { LRUCache } from 'lru-cache';
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
import {
  FunWaterfallContainer,
  FunWaterfallItem,
} from '../base/FunWaterfall.dom.js';
import type { FunGifsSection } from '../constants.dom.js';
import { FunGifsCategory, FunSectionCommon } from '../constants.dom.js';
import { FunKeyboard } from '../keyboard/FunKeyboard.dom.js';
import type { WaterfallKeyboardState } from '../keyboard/WaterfallKeyboardDelegate.dom.js';
import { WaterfallKeyboardDelegate } from '../keyboard/WaterfallKeyboardDelegate.dom.js';
import { useInfiniteQuery } from '../data/infinite.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import type { GifsPaginated } from '../data/gifs.preload.js';
import { drop } from '../../../util/drop.std.js';
import { useFunContext } from '../FunProvider.dom.js';
import {
  FunResults,
  FunResultsButton,
  FunResultsFigure,
  FunResultsHeader,
  FunResultsSpinner,
} from '../base/FunResults.dom.js';
import { FunStaticEmoji } from '../FunEmoji.dom.js';
import {
  FunLightboxPortal,
  FunLightboxBackdrop,
  FunLightboxDialog,
  FunLightboxProvider,
  useFunLightboxKey,
} from '../base/FunLightbox.dom.js';
import type { tenorDownload } from '../data/tenor.preload.js';
import { FunGif } from '../FunGif.dom.js';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { isAbortError } from '../../../util/isAbortError.std.js';
import { createLogger } from '../../../logging/log.std.js';
import * as Errors from '../../../types/errors.std.js';
import {
  EMOJI_VARIANT_KEY_CONSTANTS,
  getEmojiVariantByKey,
} from '../data/emojis.std.js';

const log = createLogger('FunPanelGifs');

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

function getSelectedSection(
  hasSearchQuery: boolean,
  hasRecentGifs: boolean
): FunGifsSection {
  if (hasSearchQuery) {
    return FunSectionCommon.SearchResults;
  }
  if (hasRecentGifs) {
    return FunSectionCommon.Recents;
  }
  return FunGifsCategory.Trending;
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
  gif: GifType;
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
    storedSearchInput,
    onStoredSearchInputChange,
    recentGifs,
    fetchGifsFeatured,
    fetchGifsSearch,
    fetchGif,
    onSelectGif: onFunSelectGif,
  } = fun;

  const scrollerRef = useRef<HTMLDivElement>(null);

  const [searchInput, setSearchInput] = useState(storedSearchInput);
  const searchQuery = useMemo(() => searchInput.trim(), [searchInput]);

  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  const [selectedSection, setSelectedSection] = useState(() => {
    const hasSearchQuery = searchQuery !== '';
    const hasRecentGifs = recentGifs.length > 0;
    return getSelectedSection(hasSearchQuery, hasRecentGifs);
  });

  const [debouncedQuery, setDebouncedQuery] = useState<GifsQuery>({
    selectedSection,
    searchQuery,
  });

  useEffect(() => {
    if (
      debouncedQuery.searchQuery === searchQuery &&
      debouncedQuery.selectedSection === selectedSection
    ) {
      // don't update twice
      return;
    }

    const query: GifsQuery = {
      selectedSection,
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
  }, [debouncedQuery, searchQuery, selectedSection]);

  const loader = useCallback(
    async (
      query: GifsQuery,
      previousPage: GifsPaginated | null,
      signal: AbortSignal
    ) => {
      const cursor = previousPage?.next ?? null;
      const limit = cursor != null ? 30 : 10;

      if (query.searchQuery !== '') {
        return fetchGifsSearch(query.searchQuery, limit, cursor, signal);
      }
      strictAssert(
        query.selectedSection !== FunSectionCommon.SearchResults,
        'Section is search results when not searching'
      );
      if (query.selectedSection === FunSectionCommon.Recents) {
        return { next: null, gifs: recentGifs };
      }
      if (query.selectedSection === FunGifsCategory.Trending) {
        return fetchGifsFeatured(limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Celebrate) {
        return fetchGifsSearch('celebrate', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Love) {
        return fetchGifsSearch('love', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.ThumbsUp) {
        return fetchGifsSearch('thumbs-up', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Surprised) {
        return fetchGifsSearch('surprised', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Excited) {
        return fetchGifsSearch('excited', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Sad) {
        return fetchGifsSearch('sad', limit, cursor, signal);
      }
      if (query.selectedSection === FunGifsCategory.Angry) {
        return fetchGifsSearch('angry', limit, cursor, signal);
      }

      throw missingCaseError(query.selectedSection);
    },
    [recentGifs, fetchGifsSearch, fetchGifsFeatured]
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
    initialOffset: 100,
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

  const handleSearchInputChange = useCallback(
    (nextSearchInput: string) => {
      const hasSearchQuery = nextSearchInput.trim() !== '';
      const hasRecentGifs = recentGifs.length > 0;
      setSelectedSection(getSelectedSection(hasSearchQuery, hasRecentGifs));
      setSearchInput(nextSearchInput);
      onStoredSearchInputChange(nextSearchInput);
    },
    [onStoredSearchInputChange, recentGifs]
  );

  const handleSelectSection = useCallback((key: string) => {
    setSearchInput('');
    setSelectedSection(key as FunGifsCategory);
  }, []);

  const handleKeyboardStateChange = useCallback(
    (state: WaterfallKeyboardState) => {
      setSelectedItemKey(state.key);
    },
    []
  );

  const handleClickGif = useCallback(
    (_event: PointerEvent, gifSelection: FunGifSelection) => {
      onFunSelectGif(gifSelection);
      onSelectGif(gifSelection);
      setSelectedItemKey(null);
      // Should always close, cannot select multiple
      onClose();
    },
    [onFunSelectGif, onSelectGif, onClose]
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
      <FunPanelHeader>
        <FunSearch
          i18n={i18n}
          searchInput={searchInput}
          onSearchInputChange={handleSearchInputChange}
          placeholder={i18n('icu:FunPanelGifs__SearchPlaceholder--Tenor')}
          aria-label={i18n('icu:FunPanelGifs__SearchLabel--Tenor')}
        />
      </FunPanelHeader>
      {visibleSelectedSection !== FunSectionCommon.SearchResults && (
        <FunPanelFooter>
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
        </FunPanelFooter>
      )}
      <FunPanelBody>
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
                  <FunStaticEmoji
                    size={16}
                    role="presentation"
                    emoji={getEmojiVariantByKey(
                      EMOJI_VARIANT_KEY_CONSTANTS.SLIGHTLY_FROWNING_FACE
                    )}
                  />
                </FunResultsHeader>
              )}
            </FunResults>
          )}
          {count !== 0 && (
            <FunLightboxProvider containerRef={scrollerRef}>
              <GifsLightbox i18n={i18n} items={items} />
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
                        onClickGif={handleClickGif}
                        fetchGif={fetchGif}
                      />
                    );
                  })}
                </FunWaterfallContainer>
              </FunKeyboard>
            </FunLightboxProvider>
          )}
        </FunScroller>
      </FunPanelBody>
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
  onClickGif: (event: PointerEvent, gifSelection: FunGifSelection) => void;
  fetchGif: typeof tenorDownload;
}) {
  const { onClickGif, fetchGif } = props;

  const handleClick = useCallback(
    async (event: PointerEvent) => {
      onClickGif(event, { gif: props.gif });
    },
    [props.gif, onClickGif]
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
      try {
        const bytes = await fetchGif(props.gif.previewMedia.url, signal);
        const blob = new Blob([bytes]);
        saveGifMediaToCache(props.gif.previewMedia, blob);
        setSrc(URL.createObjectURL(blob));
      } catch (error) {
        if (!isAbortError(error)) {
          log.error('Failed to download gif', Errors.toLogFormat(error));
        }
      }
    }

    drop(download());

    return () => {
      controller.abort();
    };
  }, [props.gif, src, fetchGif]);

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
        onClick={handleClick}
        excludeFromTabOrder={!props.isTabbable}
      >
        {src != null && (
          <FunGif
            src={src}
            width={props.gif.previewMedia.width}
            height={props.gif.previewMedia.height}
            aria-describedby={descriptionId}
          />
        )}
        <VisuallyHidden id={descriptionId}>
          {props.gif.description}
        </VisuallyHidden>
      </FunItemButton>
    </FunWaterfallItem>
  );
});

function GifsLightbox(props: {
  i18n: LocalizerType;
  items: ReadonlyArray<GifType>;
}) {
  const { i18n } = props;
  const key = useFunLightboxKey();
  const descriptionId = useId();

  const result = useMemo(() => {
    if (key == null) {
      return null;
    }
    const gif = props.items.find(item => {
      return item.id === key;
    });
    strictAssert(gif, `Must have gif for "${key}"`);
    const blob = readGifMediaFromCache(gif.previewMedia);
    strictAssert(blob, 'Missing media');
    const url = URL.createObjectURL(blob);
    return { gif, url };
  }, [props.items, key]);

  useEffect(() => {
    return () => {
      if (result != null) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result]);

  if (result == null) {
    return null;
  }

  return (
    <FunLightboxPortal>
      <FunLightboxBackdrop>
        <FunLightboxDialog
          aria-label={i18n('icu:FunPanelGifs__LightboxDialog__Label')}
        >
          <FunGif
            src={result.url}
            width={result.gif.previewMedia.width}
            height={result.gif.previewMedia.height}
            aria-describedby={descriptionId}
            ignoreReducedMotion
          />
          <VisuallyHidden id={descriptionId}>
            {result.gif.description}
          </VisuallyHidden>
        </FunLightboxDialog>
      </FunLightboxBackdrop>
    </FunLightboxPortal>
  );
}
