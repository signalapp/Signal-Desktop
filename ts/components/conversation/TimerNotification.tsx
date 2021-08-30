import React from 'react';

import { Intl } from '../Intl';

import { missingCaseError } from '../../util/missingCaseError';
import { SessionIcon, SessionIconType } from '../session/icon';
import { PropsForExpirationTimer } from '../../state/ducks/conversations';
import { ReadableMessage } from './ReadableMessage';

const TimerNotificationContent = (props: PropsForExpirationTimer) => {
  const { phoneNumber, profileName, timespan, type, disabled } = props;
  const changeKey = disabled ? 'disabledDisappearingMessages' : 'theyChangedTheTimer';

  const contact = (
    <span key={`external-${phoneNumber}`} className="module-timer-notification__contact">
      {profileName || phoneNumber}
    </span>
  );

  switch (type) {
    case 'fromOther':
      return <Intl id={changeKey} components={[contact, timespan]} />;
    case 'fromMe':
      return disabled
        ? window.i18n('youDisabledDisappearingMessages')
        : window.i18n('youChangedTheTimer', [timespan]);
    case 'fromSync':
      return disabled
        ? window.i18n('disappearingMessagesDisabled')
        : window.i18n('timerSetOnSync', [timespan]);
    default:
      throw missingCaseError(type);
  }
};

export const TimerNotification = (props: PropsForExpirationTimer) => {
  const { messageId, receivedAt, isUnread } = props;

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <div className="module-timer-notification" id={`msg-${props.messageId}`}>
        <div className="module-timer-notification__message">
          <div>
            <SessionIcon
              iconType={SessionIconType.Stopwatch}
              iconSize={'small'}
              iconColor={'#ABABAB'}
            />
          </div>

          <div>
            <TimerNotificationContent {...props} />
          </div>
        </div>
      </div>
    </ReadableMessage>
  );
};
