import React from 'react';
import {
  ConversationListItemProps,
  MemoConversationListItemWithDetails,
} from '../leftpane/conversation-list-item/ConversationListItem';
import { MessageSearchResult } from './MessageSearchResults';

export type SearchResultsProps = {
  contacts: Array<ConversationListItemProps>;
  conversations: Array<ConversationListItemProps>;
  // TODO: ww add proper typing
  messages: Array<any>;
  hideMessagesHeader: boolean;
  searchTerm: string;
};

const ContactsItem = (props: { header: string; items: Array<ConversationListItemProps> }) => {
  return (
    <div className="module-search-results__contacts">
      <div className="module-search-results__contacts-header">{props.header}</div>
      {props.items.map(contact => (
        <MemoConversationListItemWithDetails {...contact} />
      ))}
    </div>
  );
};

export const SearchResults = (props: SearchResultsProps) => {
  const { conversations, contacts, messages, searchTerm, hideMessagesHeader } = props;

  const haveConversations = conversations && conversations.length;
  const haveContacts = contacts && contacts.length;
  const haveMessages = messages && messages.length;
  const noResults = !haveConversations && !haveContacts && !haveMessages;

  return (
    <div className="module-search-results">
      {noResults ? (
        <div className="module-search-results__no-results">
          {window.i18n('noSearchResults', [searchTerm])}
        </div>
      ) : null}
      {haveConversations ? (
        <div className="module-search-results__conversations">
          <div className="module-search-results__conversations-header">
            {window.i18n('conversationsHeader')}
          </div>
          {conversations.map(conversation => (
            <MemoConversationListItemWithDetails {...conversation} />
          ))}
        </div>
      ) : null}
      {haveContacts ? (
        <ContactsItem header={window.i18n('contactsHeader')} items={contacts} />
      ) : null}

      {haveMessages ? (
        <div className="module-search-results__messages">
          {hideMessagesHeader ? null : (
            <div className="module-search-results__messages-header">
              {window.i18n('messagesHeader')}
            </div>
          )}
          {messages.map(message => (
            <MessageSearchResult key={`search-result-${message.id}`} {...message} />
          ))}
        </div>
      ) : null}
    </div>
  );
};
