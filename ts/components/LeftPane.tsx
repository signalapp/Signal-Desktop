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
  archivedConversations?: Array<ConversationListItemPropsType>;
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

export class LeftPane extends React.Component<Props> {
  public listRef: React.RefObject<any> = React.createRef();

  public scrollToTop() {
    if (this.listRef && this.listRef.current) {
      const { current } = this.listRef;
      current.scrollToRow(0);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    const { showArchived, searchResults } = this.props;

    const isNotShowingSearchResults = !searchResults;
    const hasArchiveViewChanged = showArchived !== prevProps.showArchived;

    if (isNotShowingSearchResults && hasArchiveViewChanged) {
      this.scrollToTop();
    }
  }

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
      <ConversationListItem
        key={key}
        style={style}
        {...conversation}
        onClick={openConversationInternal}
        i18n={i18n}
      />
    );
  };

  public renderArchivedButton({
    key,
    style,
  }: {
    key: string;
    style: Object;
  }): JSX.Element {
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
      <div
        key={key}
        className="module-left-pane__archived-button"
        style={style}
        role="button"
        onClick={showArchivedConversations}
      >
        {i18n('archivedConversations')}{' '}
        <span className="module-left-pane__archived-button__archived-count">
          {archivedConversations.length}
        </span>
      </div>
    );
  }

  public renderList(): JSX.Element {
    const {
      archivedConversations,
      i18n,
      conversations,
      openConversationInternal,
      startNewConversation,
      searchResults,
      showArchived,
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

    if (!conversations || !archivedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }

    // That extra 1 element added to the list is the 'archived converastions' button
    const length = showArchived
      ? archivedConversations.length
      : conversations.length + (archivedConversations.length ? 1 : 0);

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    return (
      <div className="module-left-pane__list">
        {showArchived ? (
          <div className="module-left-pane__archive-helper-text">
            {i18n('archiveHelperText')}
          </div>
        ) : null}
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              ref={this.listRef}
              conversations={conversations}
              height={height}
              rowCount={length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  }

  public renderArchivedHeader(): JSX.Element {
    const { i18n, showInbox } = this.props;

    return (
      <div className="module-left-pane__archive-header">
        <div
          role="button"
          onClick={showInbox}
          className="module-left-pane__to-inbox-button"
        />
        <div className="module-left-pane__archive-header-text">
          {i18n('archivedConversations')}
        </div>
      </div>
    );
  }

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
