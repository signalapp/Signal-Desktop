import React from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
} from 'react-virtualized';

import { Intl } from './Intl';
import { Emojify } from './conversation/Emojify';
import { Spinner } from './Spinner';
import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from './ConversationListItem';
import { StartNewConversation } from './StartNewConversation';

import { LocalizerType } from '../types/Util';

export type PropsDataType = {
  discussionsLoading: boolean;
  items: Array<SearchResultRowType>;
  messagesLoading: boolean;
  noResults: boolean;
  regionCode: string;
  searchConversationName?: string;
  searchTerm: string;
};

type StartNewConversationType = {
  type: 'start-new-conversation';
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

  renderMessageSearchResult: (id: string) => JSX.Element;
};

type PropsType = PropsDataType & PropsHousekeepingType;

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

export class SearchResults extends React.Component<PropsType> {
  public mostRecentWidth = 0;
  public mostRecentHeight = 0;
  public cellSizeCache = new CellMeasurerCache({
    defaultHeight: 80,
    fixedWidth: true,
  });
  public listRef = React.createRef<any>();

  public handleStartNewConversation = () => {
    const { regionCode, searchTerm, startNewConversation } = this.props;

    startNewConversation(searchTerm, { regionCode });
  };

  public renderRowContents(row: SearchResultRowType) {
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
    } else if (row.type === 'conversations-header') {
      return (
        <div className="module-search-results__conversations-header">
          {i18n('conversationsHeader')}
        </div>
      );
    } else if (row.type === 'conversation') {
      const { data } = row;

      return (
        <ConversationListItem
          key={data.phoneNumber}
          {...data}
          onClick={openConversationInternal}
          i18n={i18n}
        />
      );
    } else if (row.type === 'contacts-header') {
      return (
        <div className="module-search-results__contacts-header">
          {i18n('contactsHeader')}
        </div>
      );
    } else if (row.type === 'contact') {
      const { data } = row;

      return (
        <ConversationListItem
          key={data.phoneNumber}
          {...data}
          onClick={openConversationInternal}
          i18n={i18n}
        />
      );
    } else if (row.type === 'messages-header') {
      return (
        <div className="module-search-results__messages-header">
          {i18n('messagesHeader')}
        </div>
      );
    } else if (row.type === 'message') {
      const { data } = row;

      return renderMessageSearchResult(data);
    } else if (row.type === 'spinner') {
      return (
        <div className="module-search-results__spinner-container">
          <Spinner size="24px" svgSize="small" />
        </div>
      );
    } else {
      throw new Error(
        'SearchResults.renderRowContents: Encountered unknown row type'
      );
    }
  }

  public renderRow = ({
    index,
    key,
    parent,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const { items } = this.props;

    const row = items[index];

    return (
      <div key={key} style={style}>
        <CellMeasurer
          cache={this.cellSizeCache}
          columnIndex={0}
          key={key}
          parent={parent}
          rowIndex={index}
          width={this.mostRecentWidth}
        >
          {this.renderRowContents(row)}
        </CellMeasurer>
      </div>
    );
  };

  public componentDidUpdate(prevProps: PropsType) {
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

  public getList = () => {
    if (!this.listRef) {
      return;
    }

    const { current } = this.listRef;

    return current;
  };

  public recomputeRowHeights = (row?: number) => {
    const list = this.getList();
    if (!list) {
      return;
    }

    list.recomputeRowHeights(row);
  };

  public resizeAll = () => {
    this.cellSizeCache.clearAll();
    this.recomputeRowHeights(0);
  };

  public getRowCount() {
    const { items } = this.props;

    return items ? items.length : 0;
  }

  public render() {
    const {
      i18n,
      items,
      noResults,
      searchConversationName,
      searchTerm,
    } = this.props;

    if (noResults) {
      return (
        <div className="module-search-results">
          {!searchConversationName || searchTerm ? (
            <div className="module-search-results__no-results" key={searchTerm}>
              {searchConversationName ? (
                <Intl
                  id="noSearchResultsInConversation"
                  i18n={i18n}
                  components={[
                    searchTerm,
                    <Emojify key="item-1" text={searchConversationName} />,
                  ]}
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
      <div className="module-search-results">
        <AutoSizer>
          {({ height, width }) => {
            this.mostRecentWidth = width;
            this.mostRecentHeight = height;

            return (
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
                width={width}
              />
            );
          }}
        </AutoSizer>
      </div>
    );
  }
}
