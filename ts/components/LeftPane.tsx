import React from 'react';

import { ActionsPanel, SectionType } from './session/ActionsPanel';
import { LeftPaneMessageSection } from './session/LeftPaneMessageSection';

import { ConversationListItemProps } from './ConversationListItem';
import { SearchResultsProps } from './SearchResults';
import { SearchOptions } from '../types/Search';
import { ConversationType } from '../state/ducks/conversations';
import { LeftPaneContactSection } from './session/LeftPaneContactSection';
import { LeftPaneSettingSection } from './session/LeftPaneSettingSection';
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
  conversations: Array<ConversationListItemProps>;
  contacts: Array<ConversationType>;

  unreadMessageCount: number;
  searchResults?: SearchResultsProps;
  searchTerm: string;

  focusedSection: SectionType;
  focusedSettingsSection?: SessionSettingCategory;
  showLeftPaneSection: (section: SectionType) => void;
  showSettingsSection: (section: SessionSettingCategory) => void;

  isExpired: boolean;

  openConversationExternal: (id: string, messageId?: string) => void;
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

  public handleSectionSelected(section: SectionType) {
    this.props.clearSearch();
    this.props.showLeftPaneSection(section);
  }

  public render(): JSX.Element {
    return (
      <SessionTheme theme={this.props.theme}>
        <div className="module-left-pane-session">
          <ActionsPanel
            {...this.props}
            selectedSection={this.props.focusedSection}
            onSectionSelected={this.handleSectionSelected}
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
      updateSearchTerm,
      search,
      clearSearch,
      isExpired,
    } = this.props;

    return (
      <>
        <SessionOffline theme={this.props.theme} />
        {isExpired && <SessionExpiredWarning theme={this.props.theme} />}
        <LeftPaneMessageSection
          theme={this.props.theme}
          contacts={contacts}
          openConversationExternal={openConversationExternal}
          conversations={conversations}
          searchResults={searchResults}
          searchTerm={searchTerm}
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
    const settingsCategory =
      this.props.focusedSettingsSection || SessionSettingCategory.Appearance;
    return (
      <>
        <LeftPaneSettingSection
          {...this.props}
          settingsCategory={settingsCategory}
        />
      </>
    );
  }
}
