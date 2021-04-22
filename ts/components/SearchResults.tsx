import React from 'react';
import { ConversationListItemProps, ConversationListItemWithDetails } from './ConversationListItem';
import { MessageSearchResult, MessageSearchResultProps } from './MessageSearchResult';

import { LocalizerType } from '../types/Util';

export type SearchResultsProps = {
  contacts: Array<ConversationListItemProps>;
  conversations: Array<ConversationListItemProps>;
  hideMessagesHeader: boolean;
  messages: Array<MessageSearchResultProps>;
  searchTerm: string;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  openConversationExternal: (id: string, messageId?: string) => void;
};

type Props = SearchResultsProps & PropsHousekeeping;

export class SearchResults extends React.Component<Props> {
  public render() {
    const {
      conversations,
      contacts,
      hideMessagesHeader,
      i18n,
      messages,
      openConversationExternal,
      searchTerm,
    } = this.props;

    const haveConversations = conversations && conversations.length;
    const haveContacts = contacts && contacts.length;
    const haveMessages = messages && messages.length;
    const noResults = !haveConversations && !haveContacts && !haveMessages;

    return (
      <div className="module-search-results">
        {noResults ? (
          <div className="module-search-results__no-results">
            {i18n('noSearchResults', [searchTerm])}
          </div>
        ) : null}
        {haveConversations ? (
          <div className="module-search-results__conversations">
            <div className="module-search-results__conversations-header">
              {i18n('conversationsHeader')}
            </div>
            {conversations.map(conversation => (
              <ConversationListItemWithDetails
                key={conversation.phoneNumber}
                {...conversation}
                onClick={openConversationExternal}
                i18n={i18n}
              />
            ))}
          </div>
        ) : null}
        {haveContacts ? this.renderContacts(i18n('contactsHeader'), contacts) : null}

        {haveMessages ? (
          <div className="module-search-results__messages">
            {hideMessagesHeader ? null : (
              <div className="module-search-results__messages-header">{i18n('messagesHeader')}</div>
            )}
            {messages.map(message => (
              <MessageSearchResult
                key={message.id}
                {...message}
                onClick={openConversationExternal}
                i18n={i18n}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  private renderContacts(header: string, items: Array<ConversationListItemProps>) {
    const { i18n, openConversationExternal } = this.props;

    return (
      <div className="module-search-results__contacts">
        <div className="module-search-results__contacts-header">{header}</div>
        {items.map(contact => (
          <ConversationListItemWithDetails
            key={contact.phoneNumber}
            {...contact}
            onClick={openConversationExternal}
            i18n={i18n}
          />
        ))}
      </div>
    );
  }
}
