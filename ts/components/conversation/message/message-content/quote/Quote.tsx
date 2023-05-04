import React, { useState, MouseEvent } from 'react';
import classNames from 'classnames';

import * as MIME from '../../../../../types/MIME';

import { useSelector } from 'react-redux';

import { isPublicGroupConversation } from '../../../../../state/selectors/conversations';
import { QuoteAuthor } from './QuoteAuthor';
import { QuoteGenericFile } from './QuoteGenericFile';
import { QuoteText } from './QuoteText';
import { QuoteIconContainer } from './QuoteIconContainer';
import styled from 'styled-components';
import { isEmpty } from 'lodash';

export type QuotePropsWithoutListener = {
  attachment?: QuotedAttachmentType;
  sender: string;
  authorProfileName?: string;
  authorName?: string;
  isFromMe: boolean;
  isIncoming: boolean;
  text: string | null;
  referencedMessageNotFound: boolean;
};

export type QuotePropsWithListener = QuotePropsWithoutListener & {
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

function validateQuote(quote: QuotePropsWithoutListener): boolean {
  if (quote.text) {
    return true;
  }

  if (quote.attachment) {
    return true;
  }

  return false;
}

const StyledQuote = styled.div<{
  hasAttachment: boolean;
  isIncoming: boolean;
  onClick: ((e: MouseEvent<HTMLDivElement>) => void) | undefined;
}>`
  position: relative;

  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
  ${props => !props.hasAttachment && 'border-left: 4px solid;'}
  border-color: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)'};
  cursor: ${props => (props.onClick ? 'pointer' : 'auto')};
`;

export const Quote = (props: QuotePropsWithListener) => {
  const [imageBroken, setImageBroken] = useState(false);
  const handleImageErrorBound = () => {
    setImageBroken(true);
  };

  const isPublic = useSelector(isPublicGroupConversation);

  if (!validateQuote(props)) {
    return null;
  }

  const { isIncoming, attachment, text, onClick } = props;

  return (
    <div className={classNames('module-quote-container')}>
      <StyledQuote
        hasAttachment={Boolean(!isEmpty(attachment))}
        isIncoming={isIncoming}
        onClick={onClick}
        role="button"
      >
        <QuoteIconContainer
          attachment={attachment}
          handleImageErrorBound={handleImageErrorBound}
          imageBroken={imageBroken}
        />
        <div className="module-quote__primary">
          <QuoteAuthor
            authorName={props.authorName}
            author={props.sender}
            authorProfileName={props.authorProfileName}
            isFromMe={props.isFromMe}
            isIncoming={props.isIncoming}
            showPubkeyForAuthor={isPublic}
          />
          <QuoteGenericFile {...props} />
          <QuoteText isIncoming={isIncoming} text={text} attachment={attachment} />
        </div>
      </StyledQuote>
    </div>
  );
};
