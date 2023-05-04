import React from 'react';
import { QuotePropsWithoutListener } from './Quote';
import { useSelector } from 'react-redux';
import { getSelectedConversationKey } from '../../../../../state/selectors/conversations';
import { useIsPrivate } from '../../../../../hooks/useParamSelector';
import classNames from 'classnames';
import { MessageBody } from '../MessageBody';
import { MIME } from '../../../../../types';
import { GoogleChrome } from '../../../../../util';

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
    return window.i18n('photo');
  }
  if (MIME.isAudio(contentType) && isVoiceMessage) {
    return window.i18n('voiceMessage');
  }
  if (MIME.isAudio(contentType)) {
    return window.i18n('audio');
  }

  return;
}

export const QuoteText = (
  props: Pick<QuotePropsWithoutListener, 'text' | 'attachment' | 'isIncoming'>
) => {
  const { text, attachment, isIncoming } = props;

  const convoId = useSelector(getSelectedConversationKey);
  const isGroup = !useIsPrivate(convoId);

  if (text) {
    return (
      <div
        dir="auto"
        className={classNames(
          'module-quote__primary__text',
          isIncoming ? 'module-quote__primary__text--incoming' : null
        )}
      >
        <MessageBody text={text} disableLinks={true} disableJumbomoji={true} isGroup={isGroup} />
      </div>
    );
  }

  if (!attachment) {
    return null;
  }

  const { contentType, isVoiceMessage } = attachment;

  const typeLabel = getTypeLabel({ contentType, isVoiceMessage });
  if (typeLabel) {
    return (
      <div
        className={classNames(
          'module-quote__primary__type-label',
          isIncoming ? 'module-quote__primary__type-label--incoming' : null
        )}
      >
        {typeLabel}
      </div>
    );
  }

  return null;
};
