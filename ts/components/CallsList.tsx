// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Index, IndexRange, ListRowProps } from 'react-virtualized';
import { InfiniteLoader, List } from 'react-virtualized';
import classNames from 'classnames';
import type { LocalizerType } from '../types/I18N';
import { ListTile } from './ListTile';
import { Avatar, AvatarSize } from './Avatar';
import { SearchInput } from './SearchInput';
import type {
  CallHistoryFilterOptions,
  CallHistoryGroup,
  CallHistoryPagination,
} from '../types/CallDisposition';
import {
  CallHistoryFilterStatus,
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
  isSameCallHistoryGroup,
} from '../types/CallDisposition';
import { formatDateTimeShort } from '../util/timestamp';
import type { ConversationType } from '../state/ducks/conversations';
import * as log from '../logging/log';
import { refMerger } from '../util/refMerger';
import { drop } from '../util/drop';
import { strictAssert } from '../util/assert';
import { UserText } from './UserText';
import { Intl } from './Intl';
import { NavSidebarSearchHeader } from './NavSidebar';
import { SizeObserver } from '../hooks/useSizeObserver';
import { formatCallHistoryGroup } from '../util/callDisposition';
import { CallsNewCallButton } from './CallsNewCall';
import { Tooltip, TooltipPlacement } from './Tooltip';
import { Theme } from '../util/theme';

function Timestamp({
  i18n,
  timestamp,
}: {
  i18n: LocalizerType;
  timestamp: number;
}): JSX.Element {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const dateTime = useMemo(() => {
    return new Date(timestamp).toISOString();
  }, [timestamp]);

  const formatted = useMemo(() => {
    void now; // Use this as a dep so we update
    return formatDateTimeShort(i18n, timestamp);
  }, [i18n, timestamp, now]);

  return <time dateTime={dateTime}>{formatted}</time>;
}

type SearchResults = Readonly<{
  count: number;
  items: ReadonlyArray<CallHistoryGroup>;
}>;

type SearchState = Readonly<{
  state: 'init' | 'pending' | 'rejected' | 'fulfilled';
  // Note these fields shouldnt be updated until the search is fulfilled or rejected.
  options: null | { query: string; status: CallHistoryFilterStatus };
  results: null | SearchResults;
}>;

const defaultInitState: SearchState = {
  state: 'init',
  options: null,
  results: null,
};

const defaultPendingState: SearchState = {
  state: 'pending',
  options: null,
  results: {
    count: 100,
    items: [],
  },
};

type CallsListProps = Readonly<{
  hasActiveCall: boolean;
  getCallHistoryGroupsCount: (
    options: CallHistoryFilterOptions
  ) => Promise<number>;
  getCallHistoryGroups: (
    options: CallHistoryFilterOptions,
    pagination: CallHistoryPagination
  ) => Promise<Array<CallHistoryGroup>>;
  callHistoryEdition: number;
  getConversation: (id: string) => ConversationType | void;
  i18n: LocalizerType;
  selectedCallHistoryGroup: CallHistoryGroup | null;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  onSelectCallHistoryGroup: (
    conversationId: string,
    selectedCallHistoryGroup: CallHistoryGroup
  ) => void;
}>;

const CALL_LIST_ITEM_ROW_HEIGHT = 62;

function rowHeight() {
  return CALL_LIST_ITEM_ROW_HEIGHT;
}

function isSameOptions(
  a: CallHistoryFilterOptions,
  b: CallHistoryFilterOptions
) {
  return a.query === b.query && a.status === b.status;
}

export function CallsList({
  hasActiveCall,
  getCallHistoryGroupsCount,
  getCallHistoryGroups,
  callHistoryEdition,
  getConversation,
  i18n,
  selectedCallHistoryGroup,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  onSelectCallHistoryGroup,
}: CallsListProps): JSX.Element {
  const infiniteLoaderRef = useRef<InfiniteLoader>(null);
  const listRef = useRef<List>(null);
  const [queryInput, setQueryInput] = useState('');
  const [status, setStatus] = useState(CallHistoryFilterStatus.All);
  const [searchState, setSearchState] = useState(defaultInitState);

  const prevOptionsRef = useRef<CallHistoryFilterOptions | null>(null);

  const getCallHistoryGroupsCountRef = useRef(getCallHistoryGroupsCount);
  const getCallHistoryGroupsRef = useRef(getCallHistoryGroups);

  useEffect(() => {
    getCallHistoryGroupsCountRef.current = getCallHistoryGroupsCount;
    getCallHistoryGroupsRef.current = getCallHistoryGroups;
  }, [getCallHistoryGroupsCount, getCallHistoryGroups]);

  useEffect(() => {
    const controller = new AbortController();

    async function search() {
      const options: CallHistoryFilterOptions = {
        query: queryInput.toLowerCase().normalize().trim(),
        status,
      };

      let timer = setTimeout(() => {
        setSearchState(prevSearchState => {
          if (prevSearchState.state === 'init') {
            return defaultPendingState;
          }
          return prevSearchState;
        });
        timer = setTimeout(() => {
          // Show loading indicator after a delay
          setSearchState(defaultPendingState);
        }, 300);
      }, 50);

      let results: SearchResults | null = null;

      try {
        const [count, items] = await Promise.all([
          getCallHistoryGroupsCountRef.current(options),
          getCallHistoryGroupsRef.current(options, {
            offset: 0,
            limit: 100, // preloaded rows
          }),
        ]);
        results = { count, items };
      } catch (error) {
        log.error('CallsList#fetchTotal error fetching', error);
      }

      // Clear the loading indicator timeout
      clearTimeout(timer);

      // Ignore old requests
      if (controller.signal.aborted) {
        return;
      }

      // Only commit the new search state once the results are ready
      setSearchState({
        state: results == null ? 'rejected' : 'fulfilled',
        options,
        results,
      });

      const isUpdatingSameSearch =
        prevOptionsRef.current != null &&
        isSameOptions(options, prevOptionsRef.current);

      // Commit only at the end in case the search was aborted.
      prevOptionsRef.current = options;

      // Only reset the scroll position to the top when the user has changed the
      // search parameters
      if (!isUpdatingSameSearch) {
        infiniteLoaderRef.current?.resetLoadMoreRowsCache(true);
        listRef.current?.scrollToPosition(0);
      }
    }

    drop(search());

    return () => {
      controller.abort();
    };
  }, [queryInput, status, callHistoryEdition]);

  const loadMoreRows = useCallback(
    async (props: IndexRange) => {
      const { state, options } = searchState;
      if (state !== 'fulfilled') {
        return;
      }
      strictAssert(
        options != null,
        'options should never be null when status is fulfilled'
      );

      let { startIndex, stopIndex } = props;

      if (startIndex > stopIndex) {
        // flip
        [startIndex, stopIndex] = [stopIndex, startIndex];
      }

      const offset = startIndex;
      const limit = stopIndex - startIndex + 1;

      try {
        const groups = await getCallHistoryGroupsRef.current(options, {
          offset,
          limit,
        });

        if (searchState.options !== options) {
          return;
        }

        setSearchState(prevSearchState => {
          strictAssert(
            prevSearchState.results != null,
            'results should never be null here'
          );
          const newItems = prevSearchState.results.items.slice();
          newItems.splice(startIndex, stopIndex, ...groups);
          return {
            ...prevSearchState,
            results: {
              ...prevSearchState.results,
              items: newItems,
            },
          };
        });
      } catch (error) {
        log.error('CallsList#loadMoreRows error fetching', error);
      }
    },
    [searchState]
  );

  const isRowLoaded = useCallback(
    (props: Index) => {
      return searchState.results?.items[props.index] != null;
    },
    [searchState]
  );

  const rowRenderer = useCallback(
    ({ key, index, style }: ListRowProps) => {
      const item = searchState.results?.items.at(index) ?? null;
      const conversation = item != null ? getConversation(item.peerId) : null;

      if (
        searchState.state === 'pending' ||
        item == null ||
        conversation == null
      ) {
        return (
          <div key={key} style={style}>
            <ListTile
              moduleClassName="CallsList__ItemTile"
              leading={<div className="CallsList__LoadingAvatar" />}
              title={
                <span className="CallsList__LoadingText CallsList__LoadingText--title" />
              }
              subtitleMaxLines={1}
              subtitle={
                <span className="CallsList__LoadingText CallsList__LoadingText--subtitle" />
              }
            />
          </div>
        );
      }

      const isSelected =
        selectedCallHistoryGroup != null &&
        isSameCallHistoryGroup(item, selectedCallHistoryGroup);

      const wasMissed =
        item.direction === CallDirection.Incoming &&
        (item.status === DirectCallStatus.Missed ||
          item.status === GroupCallStatus.Missed);

      let statusText;
      if (wasMissed) {
        statusText = i18n('icu:CallsList__ItemCallInfo--Missed');
      } else if (item.type === CallType.Group) {
        statusText = i18n('icu:CallsList__ItemCallInfo--GroupCall');
      } else if (item.direction === CallDirection.Outgoing) {
        statusText = i18n('icu:CallsList__ItemCallInfo--Outgoing');
      } else if (item.direction === CallDirection.Incoming) {
        statusText = i18n('icu:CallsList__ItemCallInfo--Incoming');
      } else {
        strictAssert(false, 'Cannot format call');
      }

      return (
        <div
          key={key}
          style={style}
          className={classNames('CallsList__Item', {
            'CallsList__Item--selected': isSelected,
            'CallsList__Item--missed': wasMissed,
          })}
        >
          <ListTile
            moduleClassName="CallsList__ItemTile"
            aria-selected={isSelected}
            leading={
              <Avatar
                acceptedMessageRequest
                avatarPath={conversation.avatarPath}
                conversationType="group"
                i18n={i18n}
                isMe={false}
                title={conversation.title}
                sharedGroupNames={[]}
                size={AvatarSize.THIRTY_SIX}
                badge={undefined}
                className="CallsList__ItemAvatar"
              />
            }
            trailing={
              <CallsNewCallButton
                callType={item.type}
                hasActiveCall={hasActiveCall}
                onClick={() => {
                  if (item.type === CallType.Audio) {
                    onOutgoingAudioCallInConversation(conversation.id);
                  } else {
                    onOutgoingVideoCallInConversation(conversation.id);
                  }
                }}
              />
            }
            title={
              <span
                className="CallsList__ItemTitle"
                data-call={formatCallHistoryGroup(item)}
              >
                <UserText text={conversation.title} />
              </span>
            }
            subtitleMaxLines={1}
            subtitle={
              <span className="CallsList__ItemCallInfo">
                {item.children.length > 1 ? `(${item.children.length}) ` : ''}
                {statusText} &middot;{' '}
                <Timestamp i18n={i18n} timestamp={item.timestamp} />
              </span>
            }
            onClick={() => {
              onSelectCallHistoryGroup(conversation.id, item);
            }}
          />
        </div>
      );
    },
    [
      hasActiveCall,
      searchState,
      getConversation,
      selectedCallHistoryGroup,
      onSelectCallHistoryGroup,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
      i18n,
    ]
  );

  const handleSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQueryInput(event.target.value);
    },
    []
  );

  const handleSearchInputClear = useCallback(() => {
    setQueryInput('');
  }, []);

  const handleStatusToggle = useCallback(() => {
    setStatus(prevStatus => {
      return prevStatus === CallHistoryFilterStatus.All
        ? CallHistoryFilterStatus.Missed
        : CallHistoryFilterStatus.All;
    });
  }, []);

  const filteringByMissed = status === CallHistoryFilterStatus.Missed;

  const hasEmptyResults = searchState.results?.count === 0;
  const currentQuery = searchState.options?.query ?? '';

  return (
    <>
      <NavSidebarSearchHeader>
        <SearchInput
          i18n={i18n}
          placeholder={i18n('icu:CallsList__SearchInputPlaceholder')}
          onChange={handleSearchInputChange}
          onClear={handleSearchInputClear}
          value={queryInput}
        />
        <Tooltip
          direction={TooltipPlacement.Bottom}
          content={i18n('icu:CallsList__ToggleFilterByMissedLabel')}
          theme={Theme.Dark}
          delay={600}
        >
          <button
            className={classNames('CallsList__ToggleFilterByMissed', {
              'CallsList__ToggleFilterByMissed--pressed': filteringByMissed,
            })}
            type="button"
            aria-pressed={filteringByMissed}
            aria-roledescription={i18n(
              'icu:CallsList__ToggleFilterByMissed__RoleDescription'
            )}
            onClick={handleStatusToggle}
          >
            <span className="CallsList__ToggleFilterByMissedLabel">
              {i18n('icu:CallsList__ToggleFilterByMissedLabel')}
            </span>
          </button>
        </Tooltip>
      </NavSidebarSearchHeader>

      {hasEmptyResults && (
        <p className="CallsList__EmptyState">
          {currentQuery === '' ? (
            i18n('icu:CallsList__EmptyState--noQuery')
          ) : (
            <Intl
              i18n={i18n}
              id="icu:CallsList__EmptyState--hasQuery"
              components={{
                query: <UserText text={currentQuery} />,
              }}
            />
          )}
        </p>
      )}

      <SizeObserver>
        {(ref, size) => {
          return (
            <div className="CallsList__ListContainer" ref={ref}>
              {size != null && (
                <InfiniteLoader
                  ref={infiniteLoaderRef}
                  isRowLoaded={isRowLoaded}
                  loadMoreRows={loadMoreRows}
                  rowCount={searchState.results?.count}
                  minimumBatchSize={100}
                  threshold={30}
                >
                  {({ onRowsRendered, registerChild }) => {
                    return (
                      <List
                        className={classNames('CallsList__List', {
                          'CallsList__List--loading':
                            searchState.state === 'pending',
                        })}
                        ref={refMerger(listRef, registerChild)}
                        width={size.width}
                        height={size.height}
                        rowCount={searchState.results?.count ?? 0}
                        rowHeight={rowHeight}
                        rowRenderer={rowRenderer}
                        onRowsRendered={onRowsRendered}
                      />
                    );
                  }}
                </InfiniteLoader>
              )}
            </div>
          );
        }}
      </SizeObserver>
    </>
  );
}
