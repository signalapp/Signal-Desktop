import React from 'react';
import styled from 'styled-components';
import {
  ConversationListItemProps,
  MemoConversationListItemWithDetails,
} from '../leftpane/conversation-list-item/ConversationListItem';
import { MessageResultProps, MessageSearchResult } from './MessageSearchResults';

export type SearchResultsProps = {
  contactsAndGroups: Array<ConversationListItemProps>;
  messages: Array<MessageResultProps>;
  searchTerm: string;
};

const StyledSeparatorSection = styled.div`
  height: 36px;
  line-height: 36px;

  margin-inline-start: 16px;

  color: var(--color-text);

  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
`;

const SearchResultsContainer = styled.div`
  overflow-y: auto;
  max-height: 100%;
  color: var(--color-text);
  flex-grow: 1;
  width: -webkit-fill-available;
`;
const NoResults = styled.div`
  margin-top: 27px;
  width: 100%;
  text-align: center;
`;

export const SearchResults = (props: SearchResultsProps) => {
  const { contactsAndGroups, messages, searchTerm } = props;

  const haveContactsAndGroup = Boolean(contactsAndGroups?.length);
  const haveMessages = Boolean(messages?.length);
  const noResults = !haveContactsAndGroup && !haveMessages;

  return (
    <SearchResultsContainer>
      {noResults ? <NoResults>{window.i18n('noSearchResults', [searchTerm])}</NoResults> : null}
      {haveContactsAndGroup ? (
        <>
          <StyledSeparatorSection>{window.i18n('conversationsHeader')}</StyledSeparatorSection>
          {contactsAndGroups.map(contactOrGroup => (
            <MemoConversationListItemWithDetails
              {...contactOrGroup}
              mentionedUs={false}
              isBlocked={false}
              key={`search-result-convo-${contactOrGroup.id}`}
            />
          ))}
        </>
      ) : null}

      {haveMessages && (
        <>
          <StyledSeparatorSection>
            {`${window.i18n('messagesHeader')}: ${messages.length}`}
          </StyledSeparatorSection>
          {messages.map(message => (
            <MessageSearchResult key={`search-result-message-${message.id}`} {...message} />
          ))}
        </>
      )}
    </SearchResultsContainer>
  );
};
