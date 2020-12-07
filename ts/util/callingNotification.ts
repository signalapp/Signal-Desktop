// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { LocalizerType } from '../types/Util';
import { CallMode } from '../types/Calling';
import { missingCaseError } from './missingCaseError';

interface DirectCallNotificationType {
  callMode: CallMode.Direct;
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime: number;
}

interface GroupCallNotificationType {
  activeCallConversationId?: string;
  callMode: CallMode.Group;
  conversationId: string;
  creator?: {
    firstName?: string;
    isMe?: boolean;
    title: string;
  };
  ended: boolean;
  deviceCount: number;
  maxDevices: number;
  startedTime: number;
}

export type CallingNotificationType =
  | DirectCallNotificationType
  | GroupCallNotificationType;

function getDirectCallNotificationText(
  {
    wasIncoming,
    wasVideoCall,
    wasDeclined,
    acceptedTime,
  }: DirectCallNotificationType,
  i18n: LocalizerType
): string {
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

function getGroupCallNotificationText(
  notification: GroupCallNotificationType,
  i18n: LocalizerType
): string {
  if (notification.ended) {
    return i18n('calling__call-notification__ended');
  }
  if (!notification.creator) {
    return i18n('calling__call-notification__started-by-someone');
  }
  if (notification.creator.isMe) {
    return i18n('calling__call-notification__started-by-you');
  }
  return i18n('calling__call-notification__started', [
    notification.creator.firstName || notification.creator.title,
  ]);
}

export function getCallingNotificationText(
  notification: CallingNotificationType,
  i18n: LocalizerType
): string {
  switch (notification.callMode) {
    case CallMode.Direct:
      return getDirectCallNotificationText(notification, i18n);
    case CallMode.Group:
      return getGroupCallNotificationText(notification, i18n);
    default:
      window.log.error(missingCaseError(notification));
      return '';
  }
}
