// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useEffect, useRef, useState } from 'react';
import { drop } from '../../../util/drop';
import * as log from '../../../logging/log';
import * as Errors from '../../../types/errors';
import { strictAssert } from '../../../util/assert';

export type InfiniteQueryLoader<Query, Page> = (
  query: Query,
  previousPage: Page | null,
  signal: AbortSignal
) => Promise<Page>;

export type InfiniteQueryOptions<Query, Page> = Readonly<{
  /** Important! Query must be memoized */
  query: Query;
  loader: InfiniteQueryLoader<Query, Page>;
  hasNextPage: (query: Query, page: Page) => boolean;
}>;

export type InfiniteQueryState<Query, Page> = Readonly<{
  query: Query;
  pending: boolean;
  rejected: boolean;
  pages: ReadonlyArray<Page>;
  hasNextPage: boolean;
}>;

export type InfiniteQueryApi<Query, Page> = Readonly<{
  queryState: InfiniteQueryState<Query, Page>;
  fetchNextPage: () => void;
  revalidate: () => void;
}>;

export function useInfiniteQuery<Query, Page>(
  options: InfiniteQueryOptions<Query, Page>
): InfiniteQueryApi<Query, Page> {
  const loaderRef = useRef(options.loader);
  const hasNextPageRef = useRef(options.hasNextPage);
  useEffect(() => {
    loaderRef.current = options.loader;
    hasNextPageRef.current = options.hasNextPage;
  }, [options.loader, options.hasNextPage]);

  /**
   * This is used to abort both the first page and the next page fetchers
   * when the query changes.
   */
  const querySignalRef = useRef<AbortSignal | null>(null);

  const [edition, setEdition] = useState(0);
  const [state, setState] = useState<InfiniteQueryState<Query, Page>>({
    query: options.query,
    pending: false,
    rejected: false,
    pages: [],
    hasNextPage: false,
  });

  const stateRef = useRef(state);
  const update = useCallback((next: InfiniteQueryState<Query, Page>) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    querySignalRef.current = signal;

    let pendingStatusTimer: NodeJS.Timeout;

    async function firstPageFetcher() {
      // Show pending state faster if results are empty
      const isEmpty = stateRef.current.pages.length === 0;
      const showPendingStateDelay = isEmpty ? 50 : 300;

      pendingStatusTimer = setTimeout(() => {
        update({
          query: options.query,
          pending: true,
          rejected: false,
          pages: [],
          hasNextPage: false,
        });
      }, showPendingStateDelay);

      try {
        const firstPage = await loaderRef.current(options.query, null, signal);
        if (!signal.aborted) {
          update({
            query: options.query,
            pending: false,
            rejected: false,
            pages: [firstPage],
            hasNextPage: hasNextPageRef.current(options.query, firstPage),
          });
        }
      } catch (error) {
        log.error('Error fetching first page', Errors.toLogFormat(error));
        if (!signal.aborted) {
          update({
            query: options.query,
            pending: false,
            rejected: true,
            pages: [],
            hasNextPage: false,
          });
        }
      } finally {
        clearTimeout(pendingStatusTimer);
      }
    }

    drop(firstPageFetcher());

    return () => {
      clearTimeout(pendingStatusTimer);
      controller.abort();
    };
  }, [options.query, edition, update]);

  const fetchNextPage = useCallback(() => {
    strictAssert(
      querySignalRef.current,
      'Should have abort controller from first page fetcher'
    );

    if (querySignalRef.current.aborted) {
      return;
    }

    const signal = querySignalRef.current;

    async function nextPageFetcher() {
      // Show pending state immediately
      update({
        ...stateRef.current,
        pending: true,
      });

      const { query, pages } = stateRef.current;
      try {
        const prevPage = pages.at(-1);
        strictAssert(prevPage, 'Expected previous resolved page');
        const nextPage = await loaderRef.current(query, prevPage, signal);
        if (!signal.aborted) {
          update({
            query,
            pending: false,
            rejected: false,
            pages: [...pages, nextPage],
            hasNextPage: hasNextPageRef.current(query, nextPage),
          });
        }
      } catch (error) {
        log.error('Error fetching next page', Errors.toLogFormat(error));
        if (!signal.aborted) {
          update({
            query,
            pending: false,
            rejected: true,
            pages,
            hasNextPage: false,
          });
        }
      }
    }

    drop(nextPageFetcher());
  }, [update]);

  const revalidate = useCallback(() => {
    setEdition(prevEdition => prevEdition + 1);
  }, []);

  return {
    queryState: state,
    fetchNextPage,
    revalidate,
  };
}
