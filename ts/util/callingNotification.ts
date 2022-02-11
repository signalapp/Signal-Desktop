// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util';
import { CallMode } from '../types/Calling';
import { missingCaseError } from './missingCaseError';
import * as log from '../logging/log';

type DirectCallNotificationType = {
  callMode: CallMode.Direct;
  activeCallConversationId?: string;
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime: number;
};

type GroupCallNotificationType = {
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
};

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
      log.error(
        `getCallingNotificationText: missing case ${missingCaseError(
          notification
        )}`
      );
      return '';
  }
}

type CallingIconType =
  | 'audio-incoming'
  | 'audio-missed'
  | 'audio-outgoing'
  | 'phone'
  | 'video'
  | 'video-incoming'
  | 'video-missed'
  | 'video-outgoing';

function getDirectCallingIcon({
  wasIncoming,
  wasVideoCall,
  acceptedTime,
}: DirectCallNotificationType): CallingIconType {
  const wasAccepted = Boolean(acceptedTime);

  // video
  if (wasVideoCall) {
    if (wasAccepted) {
      return wasIncoming ? 'video-incoming' : 'video-outgoing';
    }
    return 'video-missed';
  }

  if (wasAccepted) {
    return wasIncoming ? 'audio-incoming' : 'audio-outgoing';
  }

  return 'audio-missed';
}

export function getCallingIcon(
  notification: CallingNotificationType
): CallingIconType {
  switch (notification.callMode) {
    case CallMode.Direct:
      return getDirectCallingIcon(notification);
    case CallMode.Group:
      return 'video';
    default:
      log.error(
        `getCallingNotificationText: missing case ${missingCaseError(
          notification
        )}`
      );
      return 'phone';
  }
}
