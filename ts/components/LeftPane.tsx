import React from 'react';

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

export class LeftPane extends React.Component<Props> {
  public renderList() {
    const {
      conversations,
      i18n,
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

    return (
      <div className="module-left-pane__list">
        {(conversations || []).map(conversation => (
          <ConversationListItem
            key={conversation.phoneNumber}
            {...conversation}
            onClick={openConversationInternal}
            i18n={i18n}
          />
        ))}
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
