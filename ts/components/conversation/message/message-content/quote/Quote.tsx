import { MouseEvent, useState } from 'react';

import { isEmpty } from 'lodash';
import styled from 'styled-components';
import { useIsMessageSelectionMode } from '../../../../../state/selectors/selectedConversation';
import * as MIME from '../../../../../types/MIME';
import { QuoteAuthor } from './QuoteAuthor';
import { QuoteIconContainer } from './QuoteIconContainer';
import { QuoteText } from './QuoteText';

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
  author: string;
  isFromMe: boolean;
  isIncoming: boolean;
  referencedMessageNotFound: boolean;
  text?: string;
  attachment?: QuotedAttachmentType;

  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
};

export interface QuotedAttachmentThumbnailType {
  contentType: MIME.MIMEType;
  /** Not included in protobuf, and is loaded asynchronously */
  objectUrl?: string;
}

export interface QuotedAttachmentType {
  contentType: MIME.MIMEType;
  fileName: string;
  /** Not included in protobuf */
  isVoiceMessage: boolean;
  thumbnail?: QuotedAttachmentThumbnailType;
}

export const Quote = (props: QuoteProps) => {
  const isSelectionMode = useIsMessageSelectionMode();
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
        onClick={e => {
          if (onClick && !isSelectionMode) {
            onClick(e);
          }
        }}
      >
        <QuoteIconContainer
          attachment={attachment}
          handleImageErrorBound={handleImageErrorBound}
          imageBroken={imageBroken}
          referencedMessageNotFound={referencedMessageNotFound}
        />
        <StyledQuoteTextContent>
          <QuoteAuthor author={props.author} isIncoming={isIncoming} />
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
