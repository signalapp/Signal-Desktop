import React = require('react');
import { ContactName } from '../../../ContactName';
import { PubKey } from '../../../../../session/types';
import styled from 'styled-components';

const StyledQuoteAuthor = styled.div<{ isIncoming: boolean }>`
  color: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)'};
  font-size: 15px;
  font-weight: bold;
  line-height: 18px;
  margin-bottom: 5px;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  .module-contact-name {
    font-weight: bold;
  }
`;

type QuoteAuthorProps = {
  author: string;
  authorProfileName?: string;
  authorName?: string;
  isFromMe: boolean;
  isIncoming: boolean;
  showPubkeyForAuthor?: boolean;
};

export const QuoteAuthor = (props: QuoteAuthorProps) => {
  const { authorProfileName, author, authorName, isFromMe, isIncoming } = props;

  return (
    <StyledQuoteAuthor isIncoming={isIncoming}>
      {isFromMe ? (
        window.i18n('you')
      ) : (
        <ContactName
          pubkey={PubKey.shorten(author)}
          name={authorName}
          profileName={authorProfileName}
          compact={true}
          shouldShowPubkey={Boolean(props.showPubkeyForAuthor)}
        />
      )}
    </StyledQuoteAuthor>
  );
};
