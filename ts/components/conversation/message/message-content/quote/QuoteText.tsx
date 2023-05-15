import React from 'react';
import { QuoteProps } from './Quote';
import { useSelector } from 'react-redux';
import { getSelectedConversationKey } from '../../../../../state/selectors/conversations';
import { useIsPrivate } from '../../../../../hooks/useParamSelector';
import { MessageBody } from '../MessageBody';
import { MIME } from '../../../../../types';
import { GoogleChrome } from '../../../../../util';
import styled from 'styled-components';
import { isEmpty } from 'lodash';

const StyledQuoteText = styled.div<{ isIncoming: boolean }>`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;

  font-size: 15px;
  line-height: 18px;
  text-align: start;

  overflow: hidden;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
  white-space: pre-wrap;

  color: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)'};
  a {
    color: ${props =>
      props.isIncoming
        ? 'var(--color-received-message-text)'
        : 'var(--message-bubbles-sent-text-color)'};
  }
`;

function getTypeLabel({
  contentType,
  isVoiceMessage,
}: {
  contentType: MIME.MIMEType;
  isVoiceMessage: boolean;
}): string | undefined {
  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    return window.i18n('video');
  }
  if (GoogleChrome.isImageTypeSupported(contentType)) {
    return window.i18n('image');
  }
  if (MIME.isAudio(contentType) && isVoiceMessage) {
    return window.i18n('voiceMessage');
  }
  if (MIME.isAudio(contentType)) {
    return window.i18n('audio');
  }
  if (
    !GoogleChrome.isVideoTypeSupported(contentType) &&
    !GoogleChrome.isImageTypeSupported(contentType) &&
    !MIME.isAudio(contentType)
  ) {
    return window.i18n('document');
  }
  return;
}

export const QuoteText = (
  props: Pick<QuoteProps, 'text' | 'attachment' | 'isIncoming' | 'referencedMessageNotFound'>
) => {
  const { text, attachment, isIncoming, referencedMessageNotFound } = props;

  const convoId = useSelector(getSelectedConversationKey);
  const isGroup = !useIsPrivate(convoId);

  if (!referencedMessageNotFound && attachment && !isEmpty(attachment)) {
    const { contentType, isVoiceMessage } = attachment;

    const typeLabel = getTypeLabel({ contentType, isVoiceMessage });
    if (typeLabel && !text) {
      return <div>{typeLabel}</div>;
    }
  }

  return (
    <StyledQuoteText isIncoming={isIncoming} dir="auto">
      <MessageBody
        text={text || window.i18n('originalMessageNotFound')}
        disableLinks={true}
        disableJumbomoji={true}
        isGroup={isGroup}
      />
    </StyledQuoteText>
  );
};
