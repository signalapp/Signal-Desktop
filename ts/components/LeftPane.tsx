import React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from './ConversationListItem';
import {
  PropsData as SearchResultsProps,
  SearchResults,
} from './SearchResults';
import { LocalizerType } from '../types/Util';

export interface Props {
  conversations?: Array<ConversationListItemPropsType>;
  searchResults?: SearchResultsProps;
  i18n: LocalizerType;

  // Action Creators
  startNewConversation: () => void;
  openConversationInternal: (id: string, messageId?: string) => void;

  // Render Props
  renderMainHeader: () => JSX.Element;
}

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParams = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

export class LeftPane extends React.Component<Props> {
  public renderRow = ({ index, key, style }: RowRendererParams) => {
    const { conversations, i18n, openConversationInternal } = this.props;
    if (!conversations) {
      return null;
    }
    const conversation = conversations[index];

    return (
      <ConversationListItem
        key={key}
        style={style}
        {...conversation}
        onClick={openConversationInternal}
        i18n={i18n}
      />
    );
  };

  public renderList() {
    const {
      i18n,
      conversations,
      openConversationInternal,
      startNewConversation,
      searchResults,
    } = this.props;

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          openConversation={openConversationInternal}
          startNewConversation={startNewConversation}
          i18n={i18n}
        />
      );
    }

    if (!conversations || !conversations.length) {
      return null;
    }

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    return (
      <div className="module-left-pane__list">
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              conversations={conversations}
              height={height}
              rowCount={conversations.length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  }

  public render() {
    const { renderMainHeader } = this.props;

    return (
      <div className="module-left-pane">
        <div className="module-left-pane__header">{renderMainHeader()}</div>
        {this.renderList()}
      </div>
    );
  }
}
