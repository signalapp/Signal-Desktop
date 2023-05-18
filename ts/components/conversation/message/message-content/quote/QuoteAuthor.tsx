import React from 'react';
import { ContactName } from '../../../ContactName';
import { PubKey } from '../../../../../session/types';
import styled from 'styled-components';
import { QuoteProps } from './Quote';
import { useQuoteAuthorName } from '../../../../../hooks/useParamSelector';
import { useSelector } from 'react-redux';
import { isPublicGroupConversation } from '../../../../../state/selectors/conversations';

const StyledQuoteAuthor = styled.div<{ isIncoming: boolean }>`
  color: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)'};
  font-size: var(--font-size-md);
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

type QuoteAuthorProps = Pick<QuoteProps, 'author' | 'isIncoming'>;

export const QuoteAuthor = (props: QuoteAuthorProps) => {
  const { author, isIncoming } = props;

  const isPublic = useSelector(isPublicGroupConversation);
  const authorName = useQuoteAuthorName(author);

  if (!author || author === '' || !authorName) {
    return null;
  }

  return (
    <StyledQuoteAuthor isIncoming={isIncoming}>
      <ContactName
        pubkey={PubKey.shorten(author)}
        name={authorName}
        compact={true}
        shouldShowPubkey={Boolean(authorName && isPublic)}
      />
    </StyledQuoteAuthor>
  );
};
