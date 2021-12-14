import React from 'react';

import { missingCaseError } from '../../util/missingCaseError';
import { PropsForExpirationTimer } from '../../state/ducks/conversations';
import { NotificationBubble } from './message/message-item/notification-bubble/NotificationBubble';
import { ReadableMessage } from './message/message-item/ReadableMessage';

export const TimerNotification = (props: PropsForExpirationTimer) => {
  const { messageId, receivedAt, isUnread, pubkey, profileName, timespan, type, disabled } = props;

  const contact = profileName || pubkey;

  let textToRender: string | undefined;
  switch (type) {
    case 'fromOther':
      textToRender = disabled
        ? window.i18n('disabledDisappearingMessages', [contact, timespan])
        : window.i18n('theyChangedTheTimer', [contact, timespan]);
      break;
    case 'fromMe':
      textToRender = disabled
        ? window.i18n('youDisabledDisappearingMessages')
        : window.i18n('youChangedTheTimer', [timespan]);
      break;
    case 'fromSync':
      textToRender = disabled
        ? window.i18n('disappearingMessagesDisabled')
        : window.i18n('timerSetOnSync', [timespan]);
      break;
    default:
      throw missingCaseError(type);
  }

  if (!textToRender || textToRender.length === 0) {
    throw new Error('textToRender invalid key used TimerNotification');
  }
  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <NotificationBubble
        iconType="stopwatch"
        iconColor="inherit"
        notificationText={textToRender}
      />
    </ReadableMessage>
  );
};
