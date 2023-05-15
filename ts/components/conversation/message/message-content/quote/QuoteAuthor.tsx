import React = require('react');
import { ContactName } from '../../../ContactName';
import { PubKey } from '../../../../../session/types';
import styled from 'styled-components';
import { QuoteProps } from './Quote';

const StyledQuoteAuthor = styled.div<{ isIncoming: boolean }>`
  color: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)'};
  font-size: 15px;
  font-weight: bold;
  line-height: 18px;
  margin-bottom: 2px;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  .module-contact-name {
    font-weight: bold;
  }
`;

type QuoteAuthorProps = Pick<
  QuoteProps,
  | 'authorName'
  | 'authorProfileName'
  | 'isFromMe'
  | 'isIncoming'
  | 'referencedMessageNotFound'
  | 'sender'
> & {
  showPubkeyForAuthor?: boolean;
};

export const QuoteAuthor = (props: QuoteAuthorProps) => {
  const {
    authorProfileName,
    authorName,
    isFromMe,
    isIncoming,
    referencedMessageNotFound,
    sender,
    showPubkeyForAuthor,
  } = props;

  if (referencedMessageNotFound) {
    return null;
  }

  return (
    <StyledQuoteAuthor isIncoming={isIncoming}>
      {isFromMe ? (
        window.i18n('you')
      ) : (
        <ContactName
          pubkey={PubKey.shorten(sender)}
          name={authorName}
          profileName={authorProfileName}
          compact={true}
          shouldShowPubkey={Boolean(showPubkeyForAuthor)}
        />
      )}
    </StyledQuoteAuthor>
  );
};
