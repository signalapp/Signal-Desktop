import React from 'react';
import classNames from 'classnames';
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

import { LeftPaneSections, SectionType } from './LeftPaneSections';

export interface Props {
  conversations?: Array<ConversationListItemPropsType>;
  friends?: Array<ConversationListItemPropsType>;
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
  public state = {
    currentTab: 'conversations',
    selectedSection: SectionType.Message,
  };
  public constructor(props: Props) {
    super(props);
    this.handleSectionSelected = this.handleSectionSelected.bind(this);
  }

  public getCurrentConversations():
    | Array<ConversationListItemPropsType>
    | undefined {
    const { conversations, friends } = this.props;
    const { currentTab } = this.state;

    let conversationList =
      currentTab === 'conversations' ? conversations : friends;
    if (conversationList !== undefined) {
      conversationList = conversationList.filter(
        conversation => !conversation.isSecondary
      );
    }

    return conversationList;
  }

  public renderTabs(): JSX.Element {
    const { i18n } = this.props;
    const { currentTab } = this.state;
    const tabs = [
      {
        id: 'conversations',
        name: i18n('conversationsTab'),
      },
      {
        id: 'friends',
        name: i18n('friendsTab'),
      },
    ];

    return (
      <div className="module-left-pane__tabs" key="tabs">
        {tabs.map(tab => (
          <div
            role="button"
            className={classNames('tab', tab.id === currentTab && 'selected')}
            key={tab.id}
            onClick={() => {
              this.setState({ currentTab: tab.id });
            }}
          >
            {tab.name}
          </div>
        ))}
      </div>
    );
  }

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const {
      archivedConversations,
      i18n,
      openConversationInternal,
      showArchived,
    } = this.props;

    const { currentTab } = this.state;

    const conversations = this.getCurrentConversations();

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
        isFriendItem={currentTab !== 'conversations'}
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

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const {
      archivedConversations,
      i18n,
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

    const conversations = this.getCurrentConversations();

    if (!conversations || !archivedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }

    // That extra 1 element added to the list is the 'archived converastions' button
    const length = showArchived
      ? archivedConversations.length
      : conversations.length + (archivedConversations.length ? 1 : 0);

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
      <div className="module-left-pane__list" key={listKey}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              conversations={conversations}
              height={height}
              rowCount={length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
              autoHeight={true}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [this.renderTabs(), archived, list];
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

  public handleSectionSelected(section: SectionType) {
    console.log('section switch to:', section);
    this.setState({ selectedSection: section });
  }

  public render(): JSX.Element {
    const { renderMainHeader, showArchived } = this.props;

    return (
      <div className="module-left-pane-session">
        <LeftPaneSections
          selectedSection={this.state.selectedSection}
          onSectionSelected={this.handleSectionSelected}
        />
        <div className="module-left-pane">
          <div className="module-left-pane__header">
            {showArchived ? this.renderArchivedHeader() : renderMainHeader()}
          </div>
          {this.renderList()}
        </div>
      </div>
    );
  }
}
