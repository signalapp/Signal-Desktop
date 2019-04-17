import React from 'react';
import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from './ConversationListItem';
import {
  MessageSearchResult,
  PropsData as MessageSearchResultPropsType,
} from './MessageSearchResult';
import { StartNewConversation } from './StartNewConversation';

import { LocalizerType } from '../types/Util';

export type PropsData = {
  contacts: Array<ConversationListItemPropsType>;
  conversations: Array<ConversationListItemPropsType>;
  hideMessagesHeader: boolean;
  messages: Array<MessageSearchResultPropsType>;
  regionCode: string;
  searchTerm: string;
  showStartNewConversation: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  openConversation: (id: string, messageId?: string) => void;
  startNewConversation: (
    query: string,
    options: { regionCode: string }
  ) => void;
};

type Props = PropsData & PropsHousekeeping;

export class SearchResults extends React.Component<Props> {
  public handleStartNewConversation = () => {
    const { regionCode, searchTerm, startNewConversation } = this.props;

    startNewConversation(searchTerm, { regionCode });
  };

  public render() {
    const {
      conversations,
      contacts,
      hideMessagesHeader,
      i18n,
      messages,
      openConversation,
      searchTerm,
      showStartNewConversation,
    } = this.props;

    const haveConversations = conversations && conversations.length;
    const haveContacts = contacts && contacts.length;
    const haveMessages = messages && messages.length;
    const noResults =
      !showStartNewConversation &&
      !haveConversations &&
      !haveContacts &&
      !haveMessages;

    return (
      <div className="module-search-results">
        {noResults ? (
          <div className="module-search-results__no-results">
            {i18n('noSearchResults', [searchTerm])}
          </div>
        ) : null}
        {showStartNewConversation ? (
          <StartNewConversation
            phoneNumber={searchTerm}
            i18n={i18n}
            onClick={this.handleStartNewConversation}
          />
        ) : null}
        {haveConversations ? (
          <div className="module-search-results__conversations">
            <div className="module-search-results__conversations-header">
              {i18n('conversationsHeader')}
            </div>
            {conversations.map(conversation => (
              <ConversationListItem
                key={conversation.phoneNumber}
                {...conversation}
                onClick={openConversation}
                i18n={i18n}
              />
            ))}
          </div>
        ) : null}
        {haveContacts ? (
          <div className="module-search-results__contacts">
            <div className="module-search-results__contacts-header">
              {i18n('contactsHeader')}
            </div>
            {contacts.map(contact => (
              <ConversationListItem
                key={contact.phoneNumber}
                {...contact}
                onClick={openConversation}
                i18n={i18n}
              />
            ))}
          </div>
        ) : null}
        {haveMessages ? (
          <div className="module-search-results__messages">
            {hideMessagesHeader ? null : (
              <div className="module-search-results__messages-header">
                {i18n('messagesHeader')}
              </div>
            )}
            {messages.map(message => (
              <MessageSearchResult
                key={message.id}
                {...message}
                onClick={openConversation}
                i18n={i18n}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
}
