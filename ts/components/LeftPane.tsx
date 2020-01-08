import React from 'react';

import { ActionsPanel, SectionType } from './session/ActionsPanel';
import { LeftPaneMessageSection } from './session/LeftPaneMessageSection';

import { PropsData as ConversationListItemPropsType } from './ConversationListItem';
import { PropsData as SearchResultsProps } from './SearchResults';
import { SearchOptions } from '../types/Search';
import { LeftPaneSectionHeader } from './session/LeftPaneSectionHeader';
import {
  SessionIconButton,
  SessionIconSize,
  SessionIconType,
} from './session/icon';
import { SessionIdEditable } from './session/SessionIdEditable';
import { UserSearchDropdown } from './session/UserSearchDropdown';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './session/SessionButton';
import { ConversationType } from '../state/ducks/conversations';
import { LeftPaneContactSection } from './session/LeftPaneContactSection';
import { LeftPaneSettingSection } from './session/LeftPaneSettingSection';

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
    selectedSection: SectionType.Contact,
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

  public static RENDER_CLOSABLE_OVERLAY(
    isAddContactView: boolean,
    onChangeSessionID: any,
    onCloseClick: any,
    onButtonClick: any,
    searchTerm: string,
    searchResults?: any,
    updateSearch?: any
  ): JSX.Element {
    const title = isAddContactView
      ? window.i18n('addContact')
      : window.i18n('enterRecipient');
    const buttonText = isAddContactView
      ? window.i18n('addContact')
      : window.i18n('message');
    const ourSessionID = window.textsecure.storage.user.getNumber();

    return (
      <div className="module-left-pane-compose">
        <div className="exit">
          <SessionIconButton
            iconSize={SessionIconSize.Small}
            iconType={SessionIconType.Exit}
            onClick={onCloseClick}
          />
        </div>
        <h2>{title}</h2>
        <h3>{window.i18n('enterSessionID')}</h3>
        <div className="module-left-pane-compose-border-container">
          <hr className="white" />
          <hr className="green" />
        </div>
        <SessionIdEditable
          editable={true}
          placeholder={window.i18n('pasteSessionIDRecipient')}
          onChange={onChangeSessionID}
        />

        <div className="session-description-long">
          {window.i18n('usersCanShareTheir...')}
        </div>
        {isAddContactView || <h4>{window.i18n('or')}</h4>}

        {isAddContactView || (
          <UserSearchDropdown
            searchTerm={searchTerm}
            updateSearch={updateSearch}
            placeholder={window.i18n('searchByIDOrDisplayName')}
            searchResults={searchResults}
          />
        )}

        {isAddContactView && (
          <div className="panel-text-divider">
            <span>{window.i18n('yourPublicKey')}</span>
          </div>
        )}

        {isAddContactView && (
          <SessionIdEditable
            editable={false}
            placeholder=""
            text={ourSessionID}
          />
        )}
        <SessionButton
          buttonColor={SessionButtonColor.Green}
          buttonType={SessionButtonType.BrandOutline}
          text={buttonText}
          onClick={onButtonClick}
        />
      </div>
    );
  }

  public handleSectionSelected(section: SectionType) {
    this.setState({ selectedSection: section });
  }

  public render(): JSX.Element {
    return (
      <div className="module-left-pane-session">
        <ActionsPanel
          selectedSection={this.state.selectedSection}
          onSectionSelected={this.handleSectionSelected}
          conversations={this.props.conversations}
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
      case SectionType.Settings:
        return this.renderSettingSection();
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
      conversations,
      searchResults,
      searchTerm,
      isSecondaryDevice,
      updateSearchTerm,
      search,
      clearSearch,
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
      />
    );
  }

  private renderSettingSection() {
    const {} = this.props;

    return <LeftPaneSettingSection />;
  }
}
