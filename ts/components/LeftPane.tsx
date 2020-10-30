// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Measure, { BoundingRect, MeasuredComponentProps } from 'react-measure';
import React, { CSSProperties } from 'react';
import { List } from 'react-virtualized';
import { debounce, get } from 'lodash';

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
  pinnedConversations?: Array<ConversationListItemPropsType>;
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
  renderExpiredBuildDialog: () => JSX.Element;
  renderMainHeader: () => JSX.Element;
  renderMessageSearchResult: (id: string) => JSX.Element;
  renderNetworkStatus: () => JSX.Element;
  renderRelinkDialog: () => JSX.Element;
  renderUpdateDialog: () => JSX.Element;
}

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Record<string, unknown>;
  style: CSSProperties;
};

export enum RowType {
  ArchiveButton,
  ArchivedConversation,
  Conversation,
  Header,
  PinnedConversation,
  Undefined,
}

export enum HeaderType {
  Pinned,
  Chats,
}

interface ArchiveButtonRow {
  type: RowType.ArchiveButton;
}

interface ConversationRow {
  index: number;
  type:
    | RowType.ArchivedConversation
    | RowType.Conversation
    | RowType.PinnedConversation;
}

interface HeaderRow {
  headerType: HeaderType;
  type: RowType.Header;
}

interface UndefinedRow {
  type: RowType.Undefined;
}

type Row = ArchiveButtonRow | ConversationRow | HeaderRow | UndefinedRow;

export class LeftPane extends React.Component<PropsType> {
  public listRef = React.createRef<List>();

  public containerRef = React.createRef<HTMLDivElement>();

  public setFocusToFirstNeeded = false;

  public setFocusToLastNeeded = false;

  public calculateRowHeight = ({ index }: { index: number }): number => {
    const { type } = this.getRowFromIndex(index);
    return type === RowType.Header ? 40 : 68;
  };

  public getRowFromIndex = (index: number): Row => {
    const {
      archivedConversations,
      conversations,
      pinnedConversations,
      showArchived,
    } = this.props;

    if (!conversations || !pinnedConversations || !archivedConversations) {
      return {
        type: RowType.Undefined,
      };
    }

    if (showArchived) {
      return {
        index,
        type: RowType.ArchivedConversation,
      };
    }

    let conversationIndex = index;

    if (pinnedConversations.length) {
      if (conversations.length) {
        if (index === 0) {
          return {
            headerType: HeaderType.Pinned,
            type: RowType.Header,
          };
        }

        if (index <= pinnedConversations.length) {
          return {
            index: index - 1,
            type: RowType.PinnedConversation,
          };
        }

        if (index === pinnedConversations.length + 1) {
          return {
            headerType: HeaderType.Chats,
            type: RowType.Header,
          };
        }

        conversationIndex -= pinnedConversations.length + 2;
      } else if (index < pinnedConversations.length) {
        return {
          index,
          type: RowType.PinnedConversation,
        };
      } else {
        conversationIndex = 0;
      }
    }

    if (conversationIndex === conversations.length) {
      return {
        type: RowType.ArchiveButton,
      };
    }

    return {
      index: conversationIndex,
      type: RowType.Conversation,
    };
  };

  public renderConversationRow(
    conversation: ConversationListItemPropsType,
    key: string,
    style: CSSProperties
  ): JSX.Element {
    const { i18n, openConversationInternal } = this.props;

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
  }

  public renderHeaderRow = (
    index: number,
    key: string,
    style: CSSProperties
  ): JSX.Element => {
    const { i18n } = this.props;

    switch (index) {
      case HeaderType.Pinned: {
        return (
          <div className="module-left-pane__header-row" key={key} style={style}>
            {i18n('LeftPane--pinned')}
          </div>
        );
      }
      case HeaderType.Chats: {
        return (
          <div className="module-left-pane__header-row" key={key} style={style}>
            {i18n('LeftPane--chats')}
          </div>
        );
      }
      default: {
        window.log.warn('LeftPane: invalid HeaderRowIndex received');
        return <></>;
      }
    }
  };

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const {
      archivedConversations,
      conversations,
      pinnedConversations,
    } = this.props;

    if (!conversations || !pinnedConversations || !archivedConversations) {
      throw new Error(
        'renderRow: Tried to render without conversations or pinnedConversations or archivedConversations'
      );
    }

    const row = this.getRowFromIndex(index);

    switch (row.type) {
      case RowType.ArchiveButton: {
        return this.renderArchivedButton(key, style);
      }
      case RowType.ArchivedConversation: {
        return this.renderConversationRow(
          archivedConversations[row.index],
          key,
          style
        );
      }
      case RowType.Conversation: {
        return this.renderConversationRow(conversations[row.index], key, style);
      }
      case RowType.Header: {
        return this.renderHeaderRow(row.headerType, key, style);
      }
      case RowType.PinnedConversation: {
        return this.renderConversationRow(
          pinnedConversations[row.index],
          key,
          style
        );
      }
      default:
        window.log.warn('LeftPane: unknown RowType received');
        return <></>;
    }
  };

  public renderArchivedButton = (
    key: string,
    style: CSSProperties
  ): JSX.Element => {
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
        type="button"
      >
        {i18n('archivedConversations')}{' '}
        <span className="module-left-pane__archived-button__archived-count">
          {archivedConversations.length}
        </span>
      </button>
    );
  };

  public handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const commandKey = get(window, 'platform') === 'darwin' && event.metaKey;
    const controlKey = get(window, 'platform') !== 'darwin' && event.ctrlKey;
    const commandOrCtrl = commandKey || controlKey;

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
    }
  };

  public handleFocus = (): void => {
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
        const target: HTMLElement | null = scrollingContainer.querySelector(
          `.module-conversation-list-item[data-id="${escapedId}"]`
        );

        if (target && target.focus) {
          target.focus();

          return;
        }
      }

      this.setFocusToFirst();
    }
  };

  public scrollToRow = (row: number): void => {
    if (!this.listRef || !this.listRef.current) {
      return;
    }

    this.listRef.current.scrollToRow(row);
  };

  public recomputeRowHeights = (): void => {
    if (!this.listRef || !this.listRef.current) {
      return;
    }

    this.listRef.current.recomputeRowHeights();
  };

  public getScrollContainer = (): HTMLDivElement | null => {
    if (!this.listRef || !this.listRef.current) {
      return null;
    }

    const list = this.listRef.current;

    // TODO: DESKTOP-689
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid: any = list.Grid;
    if (!grid || !grid._scrollingContainer) {
      return null;
    }

    return grid._scrollingContainer as HTMLDivElement;
  };

  public setFocusToFirst = (): void => {
    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer) {
      return;
    }

    const item: HTMLElement | null = scrollContainer.querySelector(
      '.module-conversation-list-item'
    );
    if (item && item.focus) {
      item.focus();
    }
  };

  public onScroll = debounce(
    (): void => {
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

        const button: HTMLElement | null = scrollContainer.querySelector(
          '.module-left-pane__archived-button'
        );
        if (button && button.focus) {
          button.focus();

          return;
        }
        const items: NodeListOf<HTMLElement> = scrollContainer.querySelectorAll(
          '.module-conversation-list-item'
        );
        if (items && items.length > 0) {
          const last = items[items.length - 1];

          if (last && last.focus) {
            last.focus();
          }
        }
      }
    },
    100,
    { maxWait: 100 }
  );

  public getLength = (): number => {
    const {
      archivedConversations,
      conversations,
      pinnedConversations,
      showArchived,
    } = this.props;

    if (!conversations || !archivedConversations || !pinnedConversations) {
      return 0;
    }

    if (showArchived) {
      return archivedConversations.length;
    }

    let { length } = conversations;

    if (pinnedConversations.length) {
      if (length) {
        // includes two additional rows for pinned/chats headers
        length += 2;
      }
      length += pinnedConversations.length;
    }

    // includes one additional row for 'archived conversations' button
    if (archivedConversations.length) {
      length += 1;
    }

    return length;
  };

  public renderList = ({
    height,
    width,
  }: BoundingRect): JSX.Element | Array<JSX.Element | null> => {
    const {
      archivedConversations,
      i18n,
      conversations,
      openConversationInternal,
      pinnedConversations,
      renderMessageSearchResult,
      startNewConversation,
      searchResults,
      showArchived,
    } = this.props;

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          height={height || 0}
          width={width || 0}
          openConversationInternal={openConversationInternal}
          startNewConversation={startNewConversation}
          renderMessageSearchResult={renderMessageSearchResult}
          i18n={i18n}
        />
      );
    }

    if (!conversations || !archivedConversations || !pinnedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }

    const length = this.getLength();

    // We ensure that the listKey differs between inbox and archive views, which ensures
    //   that AutoSizer properly detects the new size of its slot in the flexbox. The
    //   archive explainer text at the top of the archive view causes problems otherwise.
    //   It also ensures that we scroll to the top when switching views.
    const listKey = showArchived ? 1 : 0;

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    return (
      <div
        aria-live="polite"
        className="module-left-pane__list"
        key={listKey}
        onFocus={this.handleFocus}
        onKeyDown={this.handleKeyDown}
        ref={this.containerRef}
        role="presentation"
        tabIndex={-1}
      >
        <List
          className="module-left-pane__virtual-list"
          conversations={conversations}
          height={height || 0}
          onScroll={this.onScroll}
          ref={this.listRef}
          rowCount={length}
          rowHeight={this.calculateRowHeight}
          rowRenderer={this.renderRow}
          tabIndex={-1}
          width={width || 0}
        />
      </div>
    );
  };

  public renderArchivedHeader = (): JSX.Element => {
    const { i18n, showInbox } = this.props;

    return (
      <div className="module-left-pane__archive-header">
        <button
          onClick={showInbox}
          className="module-left-pane__to-inbox-button"
          title={i18n('backToInbox')}
          aria-label={i18n('backToInbox')}
          type="button"
        />
        <div className="module-left-pane__archive-header-text">
          {i18n('archivedConversations')}
        </div>
      </div>
    );
  };

  public render(): JSX.Element {
    const {
      i18n,
      renderExpiredBuildDialog,
      renderMainHeader,
      renderNetworkStatus,
      renderRelinkDialog,
      renderUpdateDialog,
      showArchived,
    } = this.props;

    // Relying on 3rd party code for contentRect.bounds
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    return (
      <div className="module-left-pane">
        <div className="module-left-pane__header">
          {showArchived ? this.renderArchivedHeader() : renderMainHeader()}
        </div>
        {renderExpiredBuildDialog()}
        {renderRelinkDialog()}
        {renderNetworkStatus()}
        {renderUpdateDialog()}
        {showArchived && (
          <div className="module-left-pane__archive-helper-text" key={0}>
            {i18n('archiveHelperText')}
          </div>
        )}
        <Measure bounds>
          {({ contentRect, measureRef }: MeasuredComponentProps) => (
            <div className="module-left-pane__list--measure" ref={measureRef}>
              <div className="module-left-pane__list--wrapper">
                {this.renderList(contentRect.bounds!)}
              </div>
            </div>
          )}
        </Measure>
      </div>
    );
  }

  componentDidUpdate(oldProps: PropsType): void {
    const {
      conversations: oldConversations = [],
      pinnedConversations: oldPinnedConversations = [],
      archivedConversations: oldArchivedConversations = [],
      showArchived: oldShowArchived,
    } = oldProps;
    const {
      conversations: newConversations = [],
      pinnedConversations: newPinnedConversations = [],
      archivedConversations: newArchivedConversations = [],
      showArchived: newShowArchived,
    } = this.props;

    const oldHasArchivedConversations = Boolean(
      oldArchivedConversations.length
    );
    const newHasArchivedConversations = Boolean(
      newArchivedConversations.length
    );

    // This could probably be optimized further, but we want to be extra-careful that our
    //   heights are correct.
    if (
      oldConversations.length !== newConversations.length ||
      oldPinnedConversations.length !== newPinnedConversations.length ||
      oldHasArchivedConversations !== newHasArchivedConversations ||
      oldShowArchived !== newShowArchived
    ) {
      this.recomputeRowHeights();
    }
  }
}
