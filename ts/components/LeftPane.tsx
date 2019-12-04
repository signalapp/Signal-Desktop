import React from 'react';
import { AutoSizer, List } from 'react-virtualized';
import { debounce } from 'lodash';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from './ConversationListItem';
import {
  PropsDataType as SearchResultsProps,
  SearchResults,
} from './SearchResults';
import { LocalizerType } from '../types/Util';
import { cleanId } from './_util';

export interface PropsType {
  conversations?: Array<ConversationListItemPropsType>;
  archivedConversations?: Array<ConversationListItemPropsType>;
  selectedConversationId?: string;
  searchResults?: SearchResultsProps;
  showArchived?: boolean;

  i18n: LocalizerType;

  // Action Creators
  startNewConversation: (
    query: string,
    options: { regionCode: string }
  ) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  showArchivedConversations: () => void;
  showInbox: () => void;

  // Render Props
  renderMainHeader: () => JSX.Element;
  renderMessageSearchResult: (id: string) => JSX.Element;
}

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

export class LeftPane extends React.Component<PropsType> {
  public listRef = React.createRef<any>();
  public containerRef = React.createRef<HTMLDivElement>();
  public setFocusToFirstNeeded = false;
  public setFocusToLastNeeded = false;

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const {
      archivedConversations,
      conversations,
      i18n,
      openConversationInternal,
      showArchived,
    } = this.props;
    if (!conversations || !archivedConversations) {
      throw new Error(
        'renderRow: Tried to render without conversations or archivedConversations'
      );
    }

    if (!showArchived && index === conversations.length) {
      return this.renderArchivedButton({ key, style });
    }

    const conversation = showArchived
      ? archivedConversations[index]
      : conversations[index];

    return (
      <div
        key={key}
        className="module-left-pane__conversation-container"
        style={style}
      >
        <ConversationListItem
          {...conversation}
          onClick={openConversationInternal}
          i18n={i18n}
        />
      </div>
    );
  };

  public renderArchivedButton = ({
    key,
    style,
  }: {
    key: string;
    style: Object;
  }): JSX.Element => {
    const {
      archivedConversations,
      i18n,
      showArchivedConversations,
    } = this.props;

    if (!archivedConversations || !archivedConversations.length) {
      throw new Error(
        'renderArchivedButton: Tried to render without archivedConversations'
      );
    }

    return (
      <button
        key={key}
        className="module-left-pane__archived-button"
        style={style}
        onClick={showArchivedConversations}
      >
        {i18n('archivedConversations')}{' '}
        <span className="module-left-pane__archived-button__archived-count">
          {archivedConversations.length}
        </span>
      </button>
    );
  };

  public handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const commandOrCtrl = event.metaKey || event.ctrlKey;

    if (commandOrCtrl && !event.shiftKey && event.key === 'ArrowUp') {
      this.scrollToRow(0);
      this.setFocusToFirstNeeded = true;

      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (commandOrCtrl && !event.shiftKey && event.key === 'ArrowDown') {
      const length = this.getLength();
      this.scrollToRow(length - 1);
      this.setFocusToLastNeeded = true;

      event.preventDefault();
      event.stopPropagation();

      return;
    }
  };

  public handleFocus = () => {
    const { selectedConversationId } = this.props;
    const { current: container } = this.containerRef;

    if (!container) {
      return;
    }

    if (document.activeElement === container) {
      const scrollingContainer = this.getScrollContainer();
      if (selectedConversationId && scrollingContainer) {
        const escapedId = cleanId(selectedConversationId).replace(
          /["\\]/g,
          '\\$&'
        );
        // tslint:disable-next-line no-unnecessary-type-assertion
        const target = scrollingContainer.querySelector(
          `.module-conversation-list-item[data-id="${escapedId}"]`
        ) as any;

        if (target && target.focus) {
          target.focus();

          return;
        }
      }

      this.setFocusToFirst();
    }
  };

  public scrollToRow = (row: number) => {
    if (!this.listRef || !this.listRef.current) {
      return;
    }

    this.listRef.current.scrollToRow(row);
  };

  public getScrollContainer = () => {
    if (!this.listRef || !this.listRef.current) {
      return;
    }

    const list = this.listRef.current;

    if (!list.Grid || !list.Grid._scrollingContainer) {
      return;
    }

    return list.Grid._scrollingContainer as HTMLDivElement;
  };

  public setFocusToFirst = () => {
    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer) {
      return;
    }

    // tslint:disable-next-line no-unnecessary-type-assertion
    const item = scrollContainer.querySelector(
      '.module-conversation-list-item'
    ) as any;
    if (item && item.focus) {
      item.focus();

      return;
    }
  };

  // tslint:disable-next-line member-ordering
  public onScroll = debounce(
    () => {
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

        // tslint:disable-next-line no-unnecessary-type-assertion
        const button = scrollContainer.querySelector(
          '.module-left-pane__archived-button'
        ) as any;
        if (button && button.focus) {
          button.focus();

          return;
        }
        // tslint:disable-next-line no-unnecessary-type-assertion
        const items = scrollContainer.querySelectorAll(
          '.module-conversation-list-item'
        ) as any;
        if (items && items.length > 0) {
          const last = items[items.length - 1];

          if (last && last.focus) {
            last.focus();

            return;
          }
        }
      }
    },
    100,
    { maxWait: 100 }
  );

  public getLength = () => {
    const { archivedConversations, conversations, showArchived } = this.props;

    if (!conversations || !archivedConversations) {
      return 0;
    }

    // That extra 1 element added to the list is the 'archived conversations' button
    return showArchived
      ? archivedConversations.length
      : conversations.length + (archivedConversations.length ? 1 : 0);
  };

  public renderList = (): JSX.Element | Array<JSX.Element | null> => {
    const {
      archivedConversations,
      i18n,
      conversations,
      openConversationInternal,
      renderMessageSearchResult,
      startNewConversation,
      searchResults,
      showArchived,
    } = this.props;

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          openConversationInternal={openConversationInternal}
          startNewConversation={startNewConversation}
          renderMessageSearchResult={renderMessageSearchResult}
          i18n={i18n}
        />
      );
    }

    if (!conversations || !archivedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }

    const length = this.getLength();

    const archived = showArchived ? (
      <div className="module-left-pane__archive-helper-text" key={0}>
        {i18n('archiveHelperText')}
      </div>
    ) : null;

    // We ensure that the listKey differs between inbox and archive views, which ensures
    //   that AutoSizer properly detects the new size of its slot in the flexbox. The
    //   archive explainer text at the top of the archive view causes problems otherwise.
    //   It also ensures that we scroll to the top when switching views.
    const listKey = showArchived ? 1 : 0;

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    const list = (
      <div
        className="module-left-pane__list"
        key={listKey}
        aria-live="polite"
        role="group"
        tabIndex={-1}
        ref={this.containerRef}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={this.listRef}
              onScroll={this.onScroll}
              className="module-left-pane__virtual-list"
              conversations={conversations}
              height={height}
              rowCount={length}
              rowHeight={68}
              tabIndex={-1}
              rowRenderer={this.renderRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [archived, list];
  };

  public renderArchivedHeader = (): JSX.Element => {
    const { i18n, showInbox } = this.props;

    return (
      <div className="module-left-pane__archive-header">
        <button
          onClick={showInbox}
          className="module-left-pane__to-inbox-button"
          title={i18n('backToInbox')}
        />
        <div className="module-left-pane__archive-header-text">
          {i18n('archivedConversations')}
        </div>
      </div>
    );
  };

  public render(): JSX.Element {
    const { renderMainHeader, showArchived } = this.props;

    return (
      <div className="module-left-pane">
        <div className="module-left-pane__header">
          {showArchived ? this.renderArchivedHeader() : renderMainHeader()}
        </div>
        {this.renderList()}
      </div>
    );
  }
}
