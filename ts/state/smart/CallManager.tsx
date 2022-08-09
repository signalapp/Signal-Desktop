// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { memoize } from 'lodash';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { calling as callingService } from '../../services/calling';
import { getIntl, getTheme } from '../selectors/user';
import { getMe, getConversationSelector } from '../selectors/conversations';
import { getActiveCall } from '../ducks/calling';
import type { ConversationType } from '../ducks/conversations';
import { getIncomingCall } from '../selectors/calling';
import { isGroupCallOutboundRingEnabled } from '../../util/isGroupCallOutboundRingEnabled';
import type {
  ActiveCallType,
  GroupCallRemoteParticipantType,
} from '../../types/Calling';
import type { UUIDStringType } from '../../types/UUID';
import { CallMode, CallState } from '../../types/Calling';
import type { StateType } from '../reducer';
import { missingCaseError } from '../../util/missingCaseError';
import { SmartCallingDeviceSelection } from './CallingDeviceSelection';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';
import { SmartSafetyNumberViewer } from './SafetyNumberViewer';
import { callingTones } from '../../util/callingTones';
import {
  bounceAppIconStart,
  bounceAppIconStop,
} from '../../shims/bounceAppIcon';
import {
  FALLBACK_NOTIFICATION_TITLE,
  NotificationSetting,
  notificationService,
} from '../../services/notifications';
import * as log from '../../logging/log';
import { getPreferredBadgeSelector } from '../selectors/badges';

function renderDeviceSelection(): JSX.Element {
  return <SmartCallingDeviceSelection />;
}

function renderSafetyNumberViewer(props: SafetyNumberProps): JSX.Element {
  return <SmartSafetyNumberViewer {...props} />;
}

const getGroupCallVideoFrameSource =
  callingService.getGroupCallVideoFrameSource.bind(callingService);

async function notifyForCall(
  title: string,
  isVideoCall: boolean
): Promise<void> {
  const shouldNotify =
    !window.SignalContext.activeWindowService.isActive() &&
    window.Events.getCallSystemNotification();
  if (!shouldNotify) {
    return;
  }

  let notificationTitle: string;

  const notificationSetting = notificationService.getNotificationSetting();
  switch (notificationSetting) {
    case NotificationSetting.Off:
    case NotificationSetting.NoNameOrMessage:
      notificationTitle = FALLBACK_NOTIFICATION_TITLE;
      break;
    case NotificationSetting.NameOnly:
    case NotificationSetting.NameAndMessage:
      notificationTitle = title;
      break;
    default:
      log.error(missingCaseError(notificationSetting));
      notificationTitle = FALLBACK_NOTIFICATION_TITLE;
      break;
  }

  notificationService.notify({
    title: notificationTitle,
    icon: isVideoCall
      ? 'images/icons/v2/video-solid-24.svg'
      : 'images/icons/v2/phone-right-solid-24.svg',
    message: window.i18n(
      isVideoCall ? 'incomingVideoCall' : 'incomingAudioCall'
    ),
    onNotificationClick: () => {
      window.showWindow();
    },
    silent: false,
  });
}

const playRingtone = callingTones.playRingtone.bind(callingTones);
const stopRingtone = callingTones.stopRingtone.bind(callingTones);

const mapStateToActiveCallProp = (
  state: StateType
): undefined | ActiveCallType => {
  const { calling } = state;
  const { activeCallState } = calling;

  if (!activeCallState) {
    return undefined;
  }

  const call = getActiveCall(calling);
  if (!call) {
    log.error('There was an active call state but no corresponding call');
    return undefined;
  }

  const conversationSelector = getConversationSelector(state);
  const conversation = conversationSelector(activeCallState.conversationId);
  if (!conversation) {
    log.error('The active call has no corresponding conversation');
    return undefined;
  }

  const conversationSelectorByUuid = memoize<
    (uuid: UUIDStringType) => undefined | ConversationType
  >(uuid => {
    const convoForUuid = window.ConversationController.lookupOrCreate({
      uuid,
    });
    return convoForUuid ? conversationSelector(convoForUuid.id) : undefined;
  });

  const baseResult = {
    conversation,
    hasLocalAudio: activeCallState.hasLocalAudio,
    hasLocalVideo: activeCallState.hasLocalVideo,
    localAudioLevel: activeCallState.localAudioLevel,
    viewMode: activeCallState.viewMode,
    joinedAt: activeCallState.joinedAt,
    outgoingRing: activeCallState.outgoingRing,
    pip: activeCallState.pip,
    presentingSource: activeCallState.presentingSource,
    presentingSourcesAvailable: activeCallState.presentingSourcesAvailable,
    settingsDialogOpen: activeCallState.settingsDialogOpen,
    showNeedsScreenRecordingPermissionsWarning: Boolean(
      activeCallState.showNeedsScreenRecordingPermissionsWarning
    ),
    showParticipantsList: activeCallState.showParticipantsList,
  };

  switch (call.callMode) {
    case CallMode.Direct:
      if (
        call.isIncoming &&
        (call.callState === CallState.Prering ||
          call.callState === CallState.Ringing)
      ) {
        return;
      }

      return {
        ...baseResult,
        callEndedReason: call.callEndedReason,
        callMode: CallMode.Direct,
        callState: call.callState,
        peekedParticipants: [],
        remoteParticipants: [
          {
            hasRemoteVideo: Boolean(call.hasRemoteVideo),
            presenting: Boolean(call.isSharingScreen),
            title: conversation.title,
            uuid: conversation.uuid,
          },
        ],
      };
    case CallMode.Group: {
      const conversationsWithSafetyNumberChanges: Array<ConversationType> = [];
      const groupMembers: Array<ConversationType> = [];
      const remoteParticipants: Array<GroupCallRemoteParticipantType> = [];
      const peekedParticipants: Array<ConversationType> = [];

      const { memberships = [] } = conversation;

      // Active calls should have peek info, but TypeScript doesn't know that so we have a
      //   fallback.
      const {
        peekInfo = {
          deviceCount: 0,
          maxDevices: Infinity,
          uuids: [],
        },
      } = call;

      for (let i = 0; i < memberships.length; i += 1) {
        const { uuid } = memberships[i];

        const member = conversationSelector(uuid);
        if (!member) {
          log.error('Group member has no corresponding conversation');
          continue;
        }

        groupMembers.push(member);
      }

      for (let i = 0; i < call.remoteParticipants.length; i += 1) {
        const remoteParticipant = call.remoteParticipants[i];

        const remoteConversation = conversationSelectorByUuid(
          remoteParticipant.uuid
        );
        if (!remoteConversation) {
          log.error('Remote participant has no corresponding conversation');
          continue;
        }

        remoteParticipants.push({
          ...remoteConversation,
          demuxId: remoteParticipant.demuxId,
          hasRemoteAudio: remoteParticipant.hasRemoteAudio,
          hasRemoteVideo: remoteParticipant.hasRemoteVideo,
          presenting: remoteParticipant.presenting,
          sharingScreen: remoteParticipant.sharingScreen,
          speakerTime: remoteParticipant.speakerTime,
          videoAspectRatio: remoteParticipant.videoAspectRatio,
        });
      }

      for (
        let i = 0;
        i < activeCallState.safetyNumberChangedUuids.length;
        i += 1
      ) {
        const uuid = activeCallState.safetyNumberChangedUuids[i];

        const remoteConversation = conversationSelectorByUuid(uuid);
        if (!remoteConversation) {
          log.error('Remote participant has no corresponding conversation');
          continue;
        }

        conversationsWithSafetyNumberChanges.push(remoteConversation);
      }

      for (let i = 0; i < peekInfo.uuids.length; i += 1) {
        const peekedParticipantUuid = peekInfo.uuids[i];

        const peekedConversation = conversationSelectorByUuid(
          peekedParticipantUuid
        );
        if (!peekedConversation) {
          log.error('Remote participant has no corresponding conversation');
          continue;
        }

        peekedParticipants.push(peekedConversation);
      }

      return {
        ...baseResult,
        callMode: CallMode.Group,
        connectionState: call.connectionState,
        conversationsWithSafetyNumberChanges,
        deviceCount: peekInfo.deviceCount,
        groupMembers,
        joinState: call.joinState,
        maxDevices: peekInfo.maxDevices,
        peekedParticipants,
        remoteParticipants,
        remoteAudioLevels: call.remoteAudioLevels || new Map<number, number>(),
      };
    }
    default:
      throw missingCaseError(call);
  }
};

const mapStateToIncomingCallProp = (state: StateType) => {
  const call = getIncomingCall(state);
  if (!call) {
    return undefined;
  }

  const conversation = getConversationSelector(state)(call.conversationId);
  if (!conversation) {
    log.error('The incoming call has no corresponding conversation');
    return undefined;
  }

  switch (call.callMode) {
    case CallMode.Direct:
      return {
        callMode: CallMode.Direct as const,
        conversation,
        isVideoCall: call.isVideoCall,
      };
    case CallMode.Group: {
      if (!call.ringerUuid) {
        log.error('The incoming group call has no ring state');
        return undefined;
      }

      const conversationSelector = getConversationSelector(state);
      const ringer = conversationSelector(call.ringerUuid);
      const otherMembersRung = (conversation.sortedGroupMembers ?? []).filter(
        c => c.id !== ringer.id && !c.isMe
      );

      return {
        callMode: CallMode.Group as const,
        conversation,
        otherMembersRung,
        ringer,
      };
    }
    default:
      throw missingCaseError(call);
  }
};

const mapStateToProps = (state: StateType) => ({
  activeCall: mapStateToActiveCallProp(state),
  bounceAppIconStart,
  bounceAppIconStop,
  availableCameras: state.calling.availableCameras,
  getGroupCallVideoFrameSource,
  getPreferredBadge: getPreferredBadgeSelector(state),
  i18n: getIntl(state),
  isGroupCallOutboundRingEnabled: isGroupCallOutboundRingEnabled(),
  incomingCall: mapStateToIncomingCallProp(state),
  me: getMe(state),
  notifyForCall,
  playRingtone,
  stopRingtone,
  renderDeviceSelection,
  renderSafetyNumberViewer,
  theme: getTheme(state),
});

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
