// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util';
import {
  CallMode,
  CallDirection,
  DirectCallStatus,
  type CallHistoryDetails,
  CallType,
  GroupCallStatus,
} from '../types/CallDisposition';
import { missingCaseError } from './missingCaseError';
import type { CallStatus } from '../types/CallDisposition';
import type { ConversationType } from '../state/ducks/conversations';
import { strictAssert } from './assert';
import { isMoreRecentThan } from './timestamp';
import { MINUTE } from './durations';

export type CallingNotificationType = Readonly<{
  // In some older calls, we don't have a call id, this hardens against that.
  callHistory: CallHistoryDetails | null;
  callCreator: ConversationType | null;
  activeConversationId: string | null;
  groupCallEnded: boolean | null;
  deviceCount: number;
  maxDevices: number;
  isSelectMode: boolean;
  isTargeted: boolean;
}>;

export function getDirectCallNotificationText(
  callDirection: CallDirection,
  callType: CallType,
  callStatus: DirectCallStatus,
  i18n: LocalizerType
): string {
  if (
    callStatus === DirectCallStatus.Pending ||
    callStatus === DirectCallStatus.Unknown
  ) {
    if (callDirection === CallDirection.Incoming) {
      return callType === CallType.Video
        ? i18n('icu:incomingVideoCall')
        : i18n('icu:incomingAudioCall');
    }
    return callType === CallType.Video
      ? i18n('icu:outgoingVideoCall')
      : i18n('icu:outgoingAudioCall');
  }

  if (callStatus === DirectCallStatus.Accepted) {
    if (callDirection === CallDirection.Incoming) {
      return callType === CallType.Video
        ? i18n('icu:acceptedIncomingVideoCall')
        : i18n('icu:acceptedIncomingAudioCall');
    }
    return callType === CallType.Video
      ? i18n('icu:acceptedOutgoingVideoCall')
      : i18n('icu:acceptedOutgoingAudioCall');
  }

  if (callStatus === DirectCallStatus.Declined) {
    if (callDirection === CallDirection.Incoming) {
      return callType === CallType.Video
        ? i18n('icu:declinedIncomingVideoCall')
        : i18n('icu:declinedIncomingAudioCall');
    }
    return callType === CallType.Video
      ? i18n('icu:missedOrDeclinedOutgoingVideoCall')
      : i18n('icu:missedOrDeclinedOutgoingAudioCall');
  }

  if (
    callStatus === DirectCallStatus.Missed ||
    callStatus === DirectCallStatus.MissedNotificationProfile
  ) {
    if (callDirection === CallDirection.Incoming) {
      return callType === CallType.Video
        ? i18n('icu:missedIncomingVideoCall')
        : i18n('icu:missedIncomingAudioCall');
    }
    return callType === CallType.Video
      ? i18n('icu:missedOrDeclinedOutgoingVideoCall')
      : i18n('icu:missedOrDeclinedOutgoingAudioCall');
  }

  if (callStatus === DirectCallStatus.Deleted) {
    throw new Error(
      'getDirectCallNotificationText: Cannot render deleted call'
    );
  }

  throw missingCaseError(callStatus);
}

function getGroupCallNotificationText({
  groupCallEnded,
  creator,
  callHistory,
  i18n,
}: {
  groupCallEnded: boolean;
  creator: ConversationType | null;
  callHistory: CallHistoryDetails;
  i18n: LocalizerType;
}): string {
  if (groupCallEnded) {
    const { direction, status, timestamp } = callHistory;
    if (direction === CallDirection.Incoming) {
      if (status === GroupCallStatus.Declined) {
        return i18n('icu:CallHistory__DescriptionVideoCall--Declined');
      }
      if (status === GroupCallStatus.Missed) {
        return i18n('icu:CallHistory__DescriptionVideoCall--Missed');
      }
      if (isMoreRecentThan(timestamp, 5 * MINUTE)) {
        return i18n('icu:calling__call-notification__ended');
      }
      return i18n('icu:acceptedIncomingVideoCall');
    }

    // Outgoing ended group calls
    if (isMoreRecentThan(timestamp, 5 * MINUTE)) {
      return i18n('icu:calling__call-notification__ended');
    }
    return i18n('icu:acceptedOutgoingVideoCall');
  }

  // TODO: Active call with participants DESKTOP-7439

  if (creator == null) {
    return i18n('icu:calling__call-notification__started-by-someone');
  }
  if (creator.isMe) {
    return i18n('icu:calling__call-notification__started-by-you');
  }
  return i18n('icu:calling__call-notification__started', {
    name: creator.systemGivenName ?? creator.title,
  });
}

export function getCallingNotificationText(
  callingNotification: CallingNotificationType,
  i18n: LocalizerType
): string | null {
  const {
    callHistory,
    callCreator: creator,
    groupCallEnded,
  } = callingNotification;
  if (callHistory == null) {
    return null;
  }

  if (callHistory.mode === CallMode.Direct) {
    return getDirectCallNotificationText(
      callHistory.direction,
      callHistory.type,
      callHistory.status as DirectCallStatus,
      i18n
    );
  }
  if (callHistory.mode === CallMode.Group) {
    strictAssert(
      groupCallEnded != null,
      'getCallingNotificationText: groupCallEnded shouldnt be null for a group call'
    );
    return getGroupCallNotificationText({
      groupCallEnded,
      creator,
      callHistory,
      i18n,
    });
  }
  if (callHistory.mode === CallMode.Adhoc) {
    return null;
  }
  throw missingCaseError(callHistory.mode);
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

export function getCallingIcon(
  callType: CallType,
  callDirection: CallDirection,
  callStatus: CallStatus
): CallingIconType {
  if (callType === CallType.Audio) {
    if (callStatus === DirectCallStatus.Accepted) {
      return callDirection === CallDirection.Incoming
        ? 'audio-incoming'
        : 'audio-outgoing';
    }
    if (
      callStatus === DirectCallStatus.Missed ||
      callStatus === DirectCallStatus.Declined
    ) {
      return 'audio-missed';
    }
    return 'phone';
  }
  if (callType === CallType.Video) {
    if (callStatus === DirectCallStatus.Accepted) {
      return callDirection === CallDirection.Incoming
        ? 'video-incoming'
        : 'video-outgoing';
    }
    if (
      callStatus === DirectCallStatus.Missed ||
      callStatus === DirectCallStatus.Declined
    ) {
      return 'video-missed';
    }
    return 'video';
  }
  if (callType === CallType.Group || callType === CallType.Adhoc) {
    return 'video';
  }
  if (callType === CallType.Unknown) {
    return 'video';
  }
  throw missingCaseError(callType);
}
