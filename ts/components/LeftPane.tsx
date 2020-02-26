import React from 'react';

import { ActionsPanel, SectionType } from './session/ActionsPanel';
import { LeftPaneMessageSection } from './session/LeftPaneMessageSection';

import { PropsData as ConversationListItemPropsType } from './ConversationListItem';
import { PropsData as SearchResultsProps } from './SearchResults';
import { SearchOptions } from '../types/Search';
import { LeftPaneSectionHeader } from './session/LeftPaneSectionHeader';

import { ConversationType } from '../state/ducks/conversations';
import { LeftPaneContactSection } from './session/LeftPaneContactSection';
import { LeftPaneSettingSection } from './session/LeftPaneSettingSection';
import { LeftPaneChannelSection } from './session/LeftPaneChannelSection';

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
export type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

interface State {
  selectedSection: SectionType;
}

interface Props {
  conversations: Array<ConversationListItemPropsType>;
  friends: Array<ConversationType>;
  sentFriendsRequest: Array<ConversationListItemPropsType>;
  receivedFriendsRequest: Array<ConversationListItemPropsType>;
  unreadMessageCount: number;
  receivedFriendRequestCount: number;
  searchResults?: SearchResultsProps;
  searchTerm: string;
  isSecondaryDevice: boolean;

  openConversationInternal: (id: string, messageId?: string) => void;
  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  clearSearch: () => void;
}

export class LeftPane extends React.Component<Props, State> {
  public state = {
    selectedSection: SectionType.Message,
  };

  public constructor(props: any) {
    super(props);
    this.handleSectionSelected = this.handleSectionSelected.bind(this);
  }

  // this static function is set here to be used by all subsections (message, contacts,...) to render their headers
  public static RENDER_HEADER(
    labels: Array<string>,
    onTabSelected?: any,
    buttonLabel?: string,
    buttonClicked?: any,
    notificationCount?: number
  ): JSX.Element {
    return (
      <LeftPaneSectionHeader
        onTabSelected={onTabSelected}
        selectedTab={0}
        labels={labels}
        buttonLabel={buttonLabel}
        buttonClicked={buttonClicked}
        notificationCount={notificationCount}
      />
    );
  }

  public handleSectionSelected(section: SectionType) {
    this.props.clearSearch();
    this.setState({ selectedSection: section });
  }

  public render(): JSX.Element {
    return (
      <div className="module-left-pane-session">
        <ActionsPanel
          selectedSection={this.state.selectedSection}
          onSectionSelected={this.handleSectionSelected}
          conversations={this.props.conversations}
          receivedFriendRequestCount={this.props.receivedFriendRequestCount}
          unreadMessageCount={this.props.unreadMessageCount}
        />
        <div className="module-left-pane">{this.renderSection()}</div>
      </div>
    );
  }

  private renderSection(): JSX.Element | undefined {
    switch (this.state.selectedSection) {
      case SectionType.Message:
        return this.renderMessageSection();
      case SectionType.Contact:
        return this.renderContactSection();
      case SectionType.Channel:
        return this.renderChannelSection();
      case SectionType.Settings:
        return this.renderSettingSection();
      case SectionType.Moon:
        return window.toggleTheme();
      default:
        return undefined;
    }
  }

  private renderMessageSection() {
    const {
      openConversationInternal,
      conversations,
      searchResults,
      searchTerm,
      isSecondaryDevice,
      updateSearchTerm,
      search,
      clearSearch,
    } = this.props;

    return (
      <LeftPaneMessageSection
        openConversationInternal={openConversationInternal}
        conversations={conversations}
        searchResults={searchResults}
        searchTerm={searchTerm}
        isSecondaryDevice={isSecondaryDevice}
        updateSearchTerm={updateSearchTerm}
        search={search}
        clearSearch={clearSearch}
      />
    );
  }

  private renderContactSection() {
    const {
      openConversationInternal,
      friends,
      sentFriendsRequest,
      receivedFriendsRequest,
      conversations,
      searchResults,
      searchTerm,
      isSecondaryDevice,
      updateSearchTerm,
      search,
      clearSearch,
      receivedFriendRequestCount,
    } = this.props;

    return (
      <LeftPaneContactSection
        openConversationInternal={openConversationInternal}
        conversations={conversations}
        friends={friends}
        searchResults={searchResults}
        searchTerm={searchTerm}
        isSecondaryDevice={isSecondaryDevice}
        updateSearchTerm={updateSearchTerm}
        search={search}
        clearSearch={clearSearch}
        sentFriendsRequest={sentFriendsRequest}
        receivedFriendsRequest={receivedFriendsRequest}
        receivedFriendRequestCount={receivedFriendRequestCount}
      />
    );
  }

  private renderSettingSection() {
    return <LeftPaneSettingSection />;
  }

  private renderChannelSection() {
    const {
      openConversationInternal,
      conversations,
      searchResults,
      searchTerm,
      isSecondaryDevice,
      updateSearchTerm,
      search,
      clearSearch,
    } = this.props;

    return (
      <LeftPaneChannelSection
        openConversationInternal={openConversationInternal}
        conversations={conversations}
        searchResults={searchResults}
        searchTerm={searchTerm}
        isSecondaryDevice={isSecondaryDevice}
        updateSearchTerm={updateSearchTerm}
        search={search}
        clearSearch={clearSearch}
      />
    );
  }
}
