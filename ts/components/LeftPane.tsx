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
import { SessionIconType } from './session/icon';
import { SessionTheme } from '../state/ducks/SessionTheme';
import { DefaultTheme } from 'styled-components';
import { SessionSettingCategory } from './session/settings/SessionSettings';
import { SessionOffline } from './session/network/SessionOffline';
import { SessionExpiredWarning } from './session/network/SessionExpiredWarning';

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
export type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

interface Props {
  ourPrimaryConversation: ConversationType;
  conversations: Array<ConversationListItemPropsType>;
  contacts: Array<ConversationType>;

  unreadMessageCount: number;
  searchResults?: SearchResultsProps;
  searchTerm: string;
  isSecondaryDevice: boolean;
  focusedSection: SectionType;
  focusSection: (section: SectionType) => void;
  isExpired: boolean;

  openConversationExternal: (id: string, messageId?: string) => void;
  showSessionSettingsCategory: (category: SessionSettingCategory) => void;
  showSessionViewConversation: () => void;
  settingsCategory?: SessionSettingCategory;
  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  clearSearch: () => void;

  theme: DefaultTheme;
}

export class LeftPane extends React.Component<Props> {
  public constructor(props: any) {
    super(props);
    this.handleSectionSelected = this.handleSectionSelected.bind(this);
  }

  // this static function is set here to be used by all subsections (message, contacts,...) to render their headers
  public static RENDER_HEADER(
    labels: Array<string>,
    theme: DefaultTheme,
    onTabSelected?: any,
    buttonLabel?: string,
    buttonIcon?: SessionIconType,
    buttonClicked?: any,
    notificationCount?: number
  ): JSX.Element {
    return (
      <LeftPaneSectionHeader
        onTabSelected={onTabSelected}
        selectedTab={0}
        labels={labels}
        buttonLabel={buttonLabel}
        buttonIcon={buttonIcon}
        buttonClicked={buttonClicked}
        notificationCount={notificationCount}
        theme={theme}
      />
    );
  }

  public handleSectionSelected(section: SectionType) {
    this.props.clearSearch();
    this.props.focusSection(section);
    if (section === SectionType.Settings) {
      this.props.showSessionSettingsCategory(SessionSettingCategory.Appearance);
    } else {
      this.props.showSessionViewConversation();
    }
  }

  public render(): JSX.Element {
    const ourPrimaryConversation = this.props.ourPrimaryConversation;
    return (
      <SessionTheme theme={this.props.theme}>
        <div className="module-left-pane-session">
          <ActionsPanel
            {...this.props}
            selectedSection={this.props.focusedSection}
            onSectionSelected={this.handleSectionSelected}
            unreadMessageCount={this.props.unreadMessageCount}
            ourPrimaryConversation={ourPrimaryConversation}
          />
          <div className="module-left-pane">{this.renderSection()}</div>
        </div>
      </SessionTheme>
    );
  }

  private renderSection(): JSX.Element | undefined {
    switch (this.props.focusedSection) {
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
      openConversationExternal,
      conversations,
      contacts,
      searchResults,
      searchTerm,
      isSecondaryDevice,
      updateSearchTerm,
      search,
      clearSearch,
      isExpired,
    } = this.props;
    // be sure to filter out secondary conversations
    let filteredConversations = conversations;
    if (conversations !== undefined) {
      filteredConversations = conversations.filter(
        conversation => !conversation.isSecondary
      );
    }

    return (
      <>
        <SessionOffline theme={this.props.theme} />
        {isExpired && <SessionExpiredWarning theme={this.props.theme} />}
        <LeftPaneMessageSection
          theme={this.props.theme}
          contacts={contacts}
          openConversationExternal={openConversationExternal}
          conversations={filteredConversations}
          searchResults={searchResults}
          searchTerm={searchTerm}
          isSecondaryDevice={isSecondaryDevice}
          updateSearchTerm={updateSearchTerm}
          search={search}
          clearSearch={clearSearch}
        />
      </>
    );
  }

  private renderContactSection() {
    const { openConversationExternal } = this.props;

    const directContacts = this.getDirectContactsOnly();

    return (
      <>
        <SessionOffline theme={this.props.theme} />
        <LeftPaneContactSection
          {...this.props}
          openConversationExternal={openConversationExternal}
          directContacts={directContacts}
        />
      </>
    );
  }

  private getDirectContactsOnly() {
    return this.props.contacts.filter(f => f.type === 'direct');
  }

  private renderSettingSection() {
    const {
      isSecondaryDevice,
      showSessionSettingsCategory,
      settingsCategory,
    } = this.props;

    const category = settingsCategory || SessionSettingCategory.Appearance;

    return (
      <>
        <LeftPaneSettingSection
          {...this.props}
          isSecondaryDevice={isSecondaryDevice}
          showSessionSettingsCategory={showSessionSettingsCategory}
          settingsCategory={category}
        />
      </>
    );
  }
}
