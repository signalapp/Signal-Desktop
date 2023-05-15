import React, { MouseEvent, useState } from 'react';

import * as MIME from '../../../../../types/MIME';

import { useSelector } from 'react-redux';

import { isPublicGroupConversation } from '../../../../../state/selectors/conversations';
import { QuoteAuthor } from './QuoteAuthor';
import { QuoteText } from './QuoteText';
import { QuoteIconContainer } from './QuoteIconContainer';
import styled from 'styled-components';
import { isEmpty } from 'lodash';

const StyledQuoteContainer = styled.div`
  min-width: 300px; // if the quoted content is small it doesn't look very good so we set a minimum
  padding-right: var(--margins-xs);
`;

const StyledQuote = styled.div<{
  hasAttachment: boolean;
  isIncoming: boolean;
  onClick: ((e: MouseEvent<HTMLDivElement>) => void) | undefined;
}>`
  position: relative;

  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin: ${props => (props.hasAttachment ? 'var(--margins-md)' : 'var(--margins-xs)')} 0;
  ${props => !props.hasAttachment && 'border-left: 4px solid;'}
  border-color: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)'};
  cursor: ${props => (props.onClick ? 'pointer' : 'auto')};
`;

const StyledQuoteTextContent = styled.div`
  flex-grow: 1;
  padding-inline-start: 10px;
  padding-inline-end: 10px;
  max-width: 100%;

  display: flex;
  flex-direction: column;
  justify-content: center;
`;

export type QuoteProps = {
  attachment?: QuotedAttachmentType;
  author: string;
  authorProfileName?: string;
  authorName?: string;
  isFromMe: boolean;
  isIncoming: boolean;
  text: string | null;
  referencedMessageNotFound: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export interface Attachment {
  contentType: MIME.MIMEType;
  /** Not included in protobuf, and is loaded asynchronously */
  objectUrl?: string;
}

export interface QuotedAttachmentType {
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf */
  isVoiceMessage: boolean;
  thumbnail?: Attachment;
}

export const Quote = (props: QuoteProps) => {
  const isPublic = useSelector(isPublicGroupConversation);

  const { isIncoming, attachment, text, referencedMessageNotFound, onClick } = props;

  const [imageBroken, setImageBroken] = useState(false);
  const handleImageErrorBound = () => {
    setImageBroken(true);
  };

  return (
    <StyledQuoteContainer>
      <StyledQuote
        hasAttachment={Boolean(!isEmpty(attachment))}
        isIncoming={isIncoming}
        onClick={onClick}
      >
        <QuoteIconContainer
          attachment={attachment}
          handleImageErrorBound={handleImageErrorBound}
          imageBroken={imageBroken}
          referencedMessageNotFound={referencedMessageNotFound}
        />
        <StyledQuoteTextContent>
          <QuoteAuthor
            author={props.author}
            authorName={props.authorName}
            isFromMe={props.isFromMe}
            isIncoming={isIncoming}
            showPubkeyForAuthor={isPublic}
          />
          <QuoteText
            isIncoming={isIncoming}
            text={text}
            attachment={attachment}
            referencedMessageNotFound={referencedMessageNotFound}
          />
        </StyledQuoteTextContent>
      </StyledQuote>
    </StyledQuoteContainer>
  );
};
