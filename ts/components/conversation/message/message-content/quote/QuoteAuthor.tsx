import styled from 'styled-components';
import { useQuoteAuthorName } from '../../../../../hooks/useParamSelector';
import { PubKey } from '../../../../../session/types';
import { useSelectedIsPublic } from '../../../../../state/selectors/selectedConversation';
import { ContactName } from '../../../ContactName';
import { QuoteProps } from './Quote';

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

  const isPublic = useSelectedIsPublic();
  const { authorName, isMe } = useQuoteAuthorName(author);

  if (!author || !authorName) {
    return null;
  }

  return (
    <StyledQuoteAuthor isIncoming={isIncoming}>
      <ContactName
        pubkey={PubKey.shorten(author)}
        name={authorName}
        shouldShowPubkey={Boolean(authorName && !isMe && isPublic)}
      />
    </StyledQuoteAuthor>
  );
};
