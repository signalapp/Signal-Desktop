import React, { CSSProperties } from 'react';
import { CellMeasurer, CellMeasurerCache, List } from 'react-virtualized';
import { debounce, get, isNumber } from 'lodash';

import { Intl } from './Intl';
import { Emojify } from './conversation/Emojify';
import { Spinner } from './Spinner';
import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from './ConversationListItem';
import { StartNewConversation } from './StartNewConversation';
import { cleanId } from './_util';

import { LocalizerType } from '../types/Util';

export type PropsDataType = {
  discussionsLoading: boolean;
  items: Array<SearchResultRowType>;
  messagesLoading: boolean;
  noResults: boolean;
  regionCode: string;
  searchConversationName?: string;
  searchTerm: string;
  selectedConversationId?: string;
  selectedMessageId?: string;
};

type StartNewConversationType = {
  type: 'start-new-conversation';
  data: undefined;
};
type NotSupportedSMS = {
  type: 'sms-mms-not-supported-text';
  data: undefined;
};
type ConversationHeaderType = {
  type: 'conversations-header';
  data: undefined;
};
type ContactsHeaderType = {
  type: 'contacts-header';
  data: undefined;
};
type MessagesHeaderType = {
  type: 'messages-header';
  data: undefined;
};
type ConversationType = {
  type: 'conversation';
  data: ConversationListItemPropsType;
};
type ContactsType = {
  type: 'contact';
  data: ConversationListItemPropsType;
};
type MessageType = {
  type: 'message';
  data: string;
};
type SpinnerType = {
  type: 'spinner';
  data: undefined;
};

export type SearchResultRowType =
  | StartNewConversationType
  | NotSupportedSMS
  | ConversationHeaderType
  | ContactsHeaderType
  | MessagesHeaderType
  | ConversationType
  | ContactsType
  | MessageType
  | SpinnerType;

type PropsHousekeepingType = {
  i18n: LocalizerType;
  openConversationInternal: (id: string, messageId?: string) => void;
  startNewConversation: (
    query: string,
    options: { regionCode: string }
  ) => void;
  height: number;
  width: number;

  renderMessageSearchResult: (id: string) => JSX.Element;
};

type PropsType = PropsDataType & PropsHousekeepingType;
type StateType = {
  scrollToIndex?: number;
};

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Record<string, unknown>;
  style: CSSProperties;
};
type OnScrollParamsType = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;

  clientWidth: number;
  scrollWidth?: number;
  scrollLeft?: number;
  scrollToColumn?: number;
  _hasScrolledToColumnTarget?: boolean;
  scrollToRow?: number;
  _hasScrolledToRowTarget?: boolean;
};

export class SearchResults extends React.Component<PropsType, StateType> {
  public setFocusToFirstNeeded = false;

  public setFocusToLastNeeded = false;

  public cellSizeCache = new CellMeasurerCache({
    defaultHeight: 80,
    fixedWidth: true,
  });

  public listRef = React.createRef<List>();

  public containerRef = React.createRef<HTMLDivElement>();

  constructor(props: PropsType) {
    super(props);
    this.state = {
      scrollToIndex: undefined,
    };
  }

  public handleStartNewConversation = (): void => {
    const { regionCode, searchTerm, startNewConversation } = this.props;

    startNewConversation(searchTerm, { regionCode });
  };

  public handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const { items } = this.props;
    const commandKey = get(window, 'platform') === 'darwin' && event.metaKey;
    const controlKey = get(window, 'platform') !== 'darwin' && event.ctrlKey;
    const commandOrCtrl = commandKey || controlKey;

    if (!items || items.length < 1) {
      return;
    }

    if (commandOrCtrl && !event.shiftKey && event.key === 'ArrowUp') {
      this.setState({ scrollToIndex: 0 });
      this.setFocusToFirstNeeded = true;

      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (commandOrCtrl && !event.shiftKey && event.key === 'ArrowDown') {
      const lastIndex = items.length - 1;
      this.setState({ scrollToIndex: lastIndex });
      this.setFocusToLastNeeded = true;

      event.preventDefault();
      event.stopPropagation();
    }
  };

  public handleFocus = (): void => {
    const { selectedConversationId, selectedMessageId } = this.props;
    const { current: container } = this.containerRef;

    if (!container) {
      return;
    }

    if (document.activeElement === container) {
      const scrollingContainer = this.getScrollContainer();

      // First we try to scroll to the selected message
      if (selectedMessageId && scrollingContainer) {
        const target: HTMLElement | null = scrollingContainer.querySelector(
          `.module-message-search-result[data-id="${selectedMessageId}"]`
        );

        if (target && target.focus) {
          target.focus();

          return;
        }
      }

      // Then we try for the selected conversation
      if (selectedConversationId && scrollingContainer) {
        const escapedId = cleanId(selectedConversationId).replace(
          /["\\]/g,
          '\\$&'
        );
        const target: HTMLElement | null = scrollingContainer.querySelector(
          `.module-conversation-list-item[data-id="${escapedId}"]`
        );

        if (target && target.focus) {
          target.focus();

          return;
        }
      }

      // Otherwise we set focus to the first non-header item
      this.setFocusToFirst();
    }
  };

  public setFocusToFirst = (): void => {
    const { current: container } = this.containerRef;

    if (container) {
      const noResultsItem: HTMLElement | null = container.querySelector(
        '.module-search-results__no-results'
      );
      if (noResultsItem && noResultsItem.focus) {
        noResultsItem.focus();

        return;
      }
    }

    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer) {
      return;
    }

    const startItem: HTMLElement | null = scrollContainer.querySelector(
      '.module-start-new-conversation'
    );
    if (startItem && startItem.focus) {
      startItem.focus();

      return;
    }

    const conversationItem: HTMLElement | null = scrollContainer.querySelector(
      '.module-conversation-list-item'
    );
    if (conversationItem && conversationItem.focus) {
      conversationItem.focus();

      return;
    }

    const messageItem: HTMLElement | null = scrollContainer.querySelector(
      '.module-message-search-result'
    );
    if (messageItem && messageItem.focus) {
      messageItem.focus();
    }
  };

  public getScrollContainer = (): HTMLDivElement | null => {
    if (!this.listRef || !this.listRef.current) {
      return null;
    }

    const list = this.listRef.current;

    // We're using an internal variable (_scrollingContainer)) here,
    // so cannot rely on the public type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid: any = list.Grid;
    if (!grid || !grid._scrollingContainer) {
      return null;
    }

    return grid._scrollingContainer as HTMLDivElement;
  };

  public onScroll = debounce(
    (data: OnScrollParamsType) => {
      // Ignore scroll events generated as react-virtualized recursively scrolls and
      //   re-measures to get us where we want to go.
      if (
        isNumber(data.scrollToRow) &&
        data.scrollToRow >= 0 &&
        !data._hasScrolledToRowTarget
      ) {
        return;
      }

      this.setState({ scrollToIndex: undefined });

      if (this.setFocusToFirstNeeded) {
        this.setFocusToFirstNeeded = false;
        this.setFocusToFirst();
      }

      if (this.setFocusToLastNeeded) {
        this.setFocusToLastNeeded = false;

        const scrollContainer = this.getScrollContainer();
        if (!scrollContainer) {
          return;
        }

        const messageItems: NodeListOf<HTMLElement> = scrollContainer.querySelectorAll(
          '.module-message-search-result'
        );
        if (messageItems && messageItems.length > 0) {
          const last = messageItems[messageItems.length - 1];

          if (last && last.focus) {
            last.focus();

            return;
          }
        }

        const contactItems: NodeListOf<HTMLElement> = scrollContainer.querySelectorAll(
          '.module-conversation-list-item'
        );
        if (contactItems && contactItems.length > 0) {
          const last = contactItems[contactItems.length - 1];

          if (last && last.focus) {
            last.focus();

            return;
          }
        }

        const startItem = scrollContainer.querySelectorAll(
          '.module-start-new-conversation'
        ) as NodeListOf<HTMLElement>;
        if (startItem && startItem.length > 0) {
          const last = startItem[startItem.length - 1];

          if (last && last.focus) {
            last.focus();
          }
        }
      }
    },
    100,
    { maxWait: 100 }
  );

  public renderRowContents(row: SearchResultRowType): JSX.Element {
    const {
      searchTerm,
      i18n,
      openConversationInternal,
      renderMessageSearchResult,
    } = this.props;

    if (row.type === 'start-new-conversation') {
      return (
        <StartNewConversation
          phoneNumber={searchTerm}
          i18n={i18n}
          onClick={this.handleStartNewConversation}
        />
      );
    }
    if (row.type === 'sms-mms-not-supported-text') {
      return (
        <div className="module-search-results__sms-not-supported">
          {i18n('notSupportedSMS')}
        </div>
      );
    }
    if (row.type === 'conversations-header') {
      return (
        <div
          className="module-search-results__conversations-header"
          role="heading"
          aria-level={1}
        >
          {i18n('conversationsHeader')}
        </div>
      );
    }
    if (row.type === 'conversation') {
      const { data } = row;

      return (
        <ConversationListItem
          key={data.phoneNumber}
          {...data}
          onClick={openConversationInternal}
          i18n={i18n}
        />
      );
    }
    if (row.type === 'contacts-header') {
      return (
        <div
          className="module-search-results__contacts-header"
          role="heading"
          aria-level={1}
        >
          {i18n('contactsHeader')}
        </div>
      );
    }
    if (row.type === 'contact') {
      const { data } = row;

      return (
        <ConversationListItem
          key={data.phoneNumber}
          {...data}
          onClick={openConversationInternal}
          i18n={i18n}
        />
      );
    }
    if (row.type === 'messages-header') {
      return (
        <div
          className="module-search-results__messages-header"
          role="heading"
          aria-level={1}
        >
          {i18n('messagesHeader')}
        </div>
      );
    }
    if (row.type === 'message') {
      const { data } = row;

      return renderMessageSearchResult(data);
    }
    if (row.type === 'spinner') {
      return (
        <div className="module-search-results__spinner-container">
          <Spinner size="24px" svgSize="small" />
        </div>
      );
    }
    throw new Error(
      'SearchResults.renderRowContents: Encountered unknown row type'
    );
  }

  public renderRow = ({
    index,
    key,
    parent,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const { items, width } = this.props;

    const row = items[index];

    return (
      <div role="row" key={key} style={style}>
        <CellMeasurer
          cache={this.cellSizeCache}
          columnIndex={0}
          key={key}
          parent={parent}
          rowIndex={index}
          width={width}
        >
          {this.renderRowContents(row)}
        </CellMeasurer>
      </div>
    );
  };

  public componentDidUpdate(prevProps: PropsType): void {
    const {
      items,
      searchTerm,
      discussionsLoading,
      messagesLoading,
    } = this.props;

    if (searchTerm !== prevProps.searchTerm) {
      this.resizeAll();
    } else if (
      discussionsLoading !== prevProps.discussionsLoading ||
      messagesLoading !== prevProps.messagesLoading
    ) {
      this.resizeAll();
    } else if (
      items &&
      prevProps.items &&
      prevProps.items.length !== items.length
    ) {
      this.resizeAll();
    }
  }

  public getList = (): List | null => {
    if (!this.listRef) {
      return null;
    }

    const { current } = this.listRef;

    return current;
  };

  public recomputeRowHeights = (row?: number): void => {
    const list = this.getList();
    if (!list) {
      return;
    }

    list.recomputeRowHeights(row);
  };

  public resizeAll = (): void => {
    this.cellSizeCache.clearAll();
    this.recomputeRowHeights(0);
  };

  public getRowCount(): number {
    const { items } = this.props;

    return items ? items.length : 0;
  }

  public render(): JSX.Element {
    const {
      height,
      i18n,
      items,
      noResults,
      searchConversationName,
      searchTerm,
      width,
    } = this.props;
    const { scrollToIndex } = this.state;

    if (noResults) {
      return (
        <div
          className="module-search-results"
          tabIndex={-1}
          ref={this.containerRef}
          onFocus={this.handleFocus}
        >
          {!searchConversationName || searchTerm ? (
            <div
              // We need this for Ctrl-T shortcut cycling through parts of app
              tabIndex={-1}
              className="module-search-results__no-results"
              key={searchTerm}
            >
              {searchConversationName ? (
                <Intl
                  id="noSearchResultsInConversation"
                  i18n={i18n}
                  components={{
                    searchTerm,
                    conversationName: (
                      <Emojify key="item-1" text={searchConversationName} />
                    ),
                  }}
                />
              ) : (
                i18n('noSearchResults', [searchTerm])
              )}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div
        className="module-search-results"
        aria-live="polite"
        role="presentation"
        tabIndex={-1}
        ref={this.containerRef}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
      >
        <List
          className="module-search-results__virtual-list"
          deferredMeasurementCache={this.cellSizeCache}
          height={height}
          items={items}
          overscanRowCount={5}
          ref={this.listRef}
          rowCount={this.getRowCount()}
          rowHeight={this.cellSizeCache.rowHeight}
          rowRenderer={this.renderRow}
          scrollToIndex={scrollToIndex}
          tabIndex={-1}
          // TODO: DESKTOP-687
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onScroll={this.onScroll as any}
          width={width}
        />
      </div>
    );
  }
}
