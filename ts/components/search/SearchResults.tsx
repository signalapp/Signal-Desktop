import React from 'react';
import {
  ConversationListItemProps,
  MemoConversationListItemWithDetails,
} from '../leftpane/conversation-list-item/ConversationListItem';
import { MessageResultProps, MessageSearchResult } from './MessageSearchResults';

export type SearchResultsProps = {
  contacts: Array<ConversationListItemProps>;
  conversations: Array<ConversationListItemProps>;
  messages: Array<MessageResultProps>;
  searchTerm: string;
};

const ContactsItem = (props: { header: string; items: Array<ConversationListItemProps> }) => {
  return (
    <div className="module-search-results__contacts">
      <div className="module-search-results__contacts-header">{props.header}</div>
      {props.items.map(contact => (
        <MemoConversationListItemWithDetails
          {...contact}
          key={`search-result-contact-${contact.id}`}
        />
      ))}
    </div>
  );
};

export const SearchResults = (props: SearchResultsProps) => {
  const { conversations, contacts, messages, searchTerm } = props;

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
            <MemoConversationListItemWithDetails
              {...conversation}
              mentionedUs={false}
              key={`search-result-convo-${conversation.id}`}
            />
          ))}
        </div>
      ) : null}
      {haveContacts ? (
        <ContactsItem header={window.i18n('contactsHeader')} items={contacts} />
      ) : null}

      {haveMessages ? (
        <div className="module-search-results__messages">
          <div className="module-search-results__messages-header">
            {`${window.i18n('messagesHeader')}: ${messages.length}`}
          </div>
          {messages.map(message => (
            <MessageSearchResult key={`search-result-message-${message.id}`} {...message} />
          ))}
        </div>
      ) : null}
    </div>
  );
};
