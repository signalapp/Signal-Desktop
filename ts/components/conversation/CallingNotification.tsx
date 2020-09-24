import React from 'react';

import { Timestamp } from './Timestamp';
import { LocalizerType } from '../../types/Util';
import { CallHistoryDetailsType } from '../../types/Calling';

export type PropsData = {
  // Can be undefined because it comes from JS.
  callHistoryDetails?: CallHistoryDetailsType;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

type Props = PropsData & PropsHousekeeping;

export function getCallingNotificationText(
  callHistoryDetails: CallHistoryDetailsType,
  i18n: LocalizerType
): string {
  const {
    wasIncoming,
    wasVideoCall,
    wasDeclined,
    acceptedTime,
  } = callHistoryDetails;
  const wasAccepted = Boolean(acceptedTime);

  if (wasIncoming) {
    if (wasDeclined) {
      if (wasVideoCall) {
        return i18n('declinedIncomingVideoCall');
      }
      return i18n('declinedIncomingAudioCall');
    }
    if (wasAccepted) {
      if (wasVideoCall) {
        return i18n('acceptedIncomingVideoCall');
      }
      return i18n('acceptedIncomingAudioCall');
    }
    if (wasVideoCall) {
      return i18n('missedIncomingVideoCall');
    }
    return i18n('missedIncomingAudioCall');
  }
  if (wasAccepted) {
    if (wasVideoCall) {
      return i18n('acceptedOutgoingVideoCall');
    }
    return i18n('acceptedOutgoingAudioCall');
  }
  if (wasVideoCall) {
    return i18n('missedOrDeclinedOutgoingVideoCall');
  }
  return i18n('missedOrDeclinedOutgoingAudioCall');
}

export const CallingNotification = (props: Props): JSX.Element | null => {
  const { callHistoryDetails, i18n } = props;
  if (!callHistoryDetails) {
    return null;
  }
  const { acceptedTime, endedTime, wasVideoCall } = callHistoryDetails;
  const callType = wasVideoCall ? 'video' : 'audio';
  return (
    <div
      className={`module-message-calling--notification module-message-calling--${callType}`}
    >
      <div className={`module-message-calling--${callType}__icon`} />
      {getCallingNotificationText(callHistoryDetails, i18n)}
      <div>
        <Timestamp
          i18n={i18n}
          timestamp={acceptedTime || endedTime}
          extended
          direction="outgoing"
          withImageNoCaption={false}
          withSticker={false}
          withTapToViewExpired={false}
          module="module-message__metadata__date"
        />
      </div>
    </div>
  );
};
