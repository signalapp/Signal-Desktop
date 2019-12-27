import React from 'react';

import { ActionsPanel, SectionType } from './session/ActionsPanel';
import { LeftPaneMessageSection } from './session/LeftPaneMessageSection';

import { PropsData as ConversationListItemPropsType } from './ConversationListItem';
import { PropsData as SearchResultsProps } from './SearchResults';
import { SearchOptions } from '../types/Search';
import { LeftPaneSectionHeader } from './session/LeftPaneSectionHeader';
import { LeftPaneContactSection } from './session/LeftPaneContactSection';

interface State {
  selectedSection: SectionType;
}

interface Props {
  conversations?: Array<ConversationListItemPropsType>;
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

  public handleSectionSelected(section: SectionType) {
    this.setState({ selectedSection: section });
  }

  public render(): JSX.Element {
    return (
      <div className="module-left-pane-session">
        <ActionsPanel
          selectedSection={this.state.selectedSection}
          onSectionSelected={this.handleSectionSelected}
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
        searchResults={searchResults}
        searchTerm={searchTerm}
        isSecondaryDevice={isSecondaryDevice}
        updateSearchTerm={updateSearchTerm}
        search={search}
        clearSearch={clearSearch}
      />
    );
  }

  static renderHeader(
    labels: Array<string>,
    onTabSelected?: any,
    buttonLabel?: string,
    buttonClicked?: any
  ): JSX.Element {
    return (
      <LeftPaneSectionHeader
        onTabSelected={onTabSelected}
        selectedTab={0}
        labels={labels}
        buttonLabel={buttonLabel}
        buttonClicked={buttonClicked}
      />
    );
  }
}
