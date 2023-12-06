// Copyright 2020 Signal Messenger, LLC
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
import { isGroupCallRaiseHandEnabled } from '../../util/isGroupCallRaiseHandEnabled';
import { isGroupCallReactionsEnabled } from '../../util/isGroupCallReactionsEnabled';
import type {
  ActiveCallBaseType,
  ActiveCallType,
  ActiveDirectCallType,
  ActiveGroupCallType,
  ConversationsByDemuxIdType,
  GroupCallRemoteParticipantType,
} from '../../types/Calling';
import { isAciString } from '../../util/isAciString';
import type { AciString } from '../../types/ServiceId';
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
  NotificationType,
  notificationService,
} from '../../services/notifications';
import * as log from '../../logging/log';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { isConversationTooBigToRing } from '../../conversations/isConversationTooBigToRing';
import { strictAssert } from '../../util/assert';
import { renderEmojiPicker } from './renderEmojiPicker';
import { renderReactionPicker } from './renderReactionPicker';

function renderDeviceSelection(): JSX.Element {
  return <SmartCallingDeviceSelection />;
}

function renderSafetyNumberViewer(props: SafetyNumberProps): JSX.Element {
  return <SmartSafetyNumberViewer {...props} />;
}

const getGroupCallVideoFrameSource =
  callingService.getGroupCallVideoFrameSource.bind(callingService);

async function notifyForCall(
  conversationId: string,
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

  const conversation = window.ConversationController.get(conversationId);
  strictAssert(conversation, 'notifyForCall: conversation not found');

  const { url, absolutePath } = await conversation.getAvatarOrIdenticon();

  notificationService.notify({
    conversationId,
    title: notificationTitle,
    iconPath: absolutePath,
    iconUrl: url,
    message: isVideoCall
      ? window.i18n('icu:incomingVideoCall')
      : window.i18n('icu:incomingAudioCall'),
    sentAt: 0,
    // The ringtone plays so we don't need sound for the notification
    silent: true,
    type: NotificationType.IncomingCall,
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

  const conversationSelectorByAci = memoize<
    (aci: AciString) => undefined | ConversationType
  >(aci => {
    const convoForAci = window.ConversationController.lookupOrCreate({
      serviceId: aci,
      reason: 'CallManager.mapStateToActiveCallProp',
    });
    return convoForAci ? conversationSelector(convoForAci.id) : undefined;
  });

  const baseResult: ActiveCallBaseType = {
    conversation,
    hasLocalAudio: activeCallState.hasLocalAudio,
    hasLocalVideo: activeCallState.hasLocalVideo,
    localAudioLevel: activeCallState.localAudioLevel,
    viewMode: activeCallState.viewMode,
    viewModeBeforePresentation: activeCallState.viewModeBeforePresentation,
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
    reactions: activeCallState.reactions,
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

      strictAssert(
        isAciString(conversation.serviceId),
        'Conversation must have aci'
      );

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
            serviceId: conversation.serviceId,
          },
        ],
      } satisfies ActiveDirectCallType;
    case CallMode.Group: {
      const conversationsWithSafetyNumberChanges: Array<ConversationType> = [];
      const groupMembers: Array<ConversationType> = [];
      const remoteParticipants: Array<GroupCallRemoteParticipantType> = [];
      const peekedParticipants: Array<ConversationType> = [];
      const conversationsByDemuxId: ConversationsByDemuxIdType = new Map();
      const { localDemuxId } = call;
      const raisedHands: Set<number> = new Set(call.raisedHands ?? []);

      const { memberships = [] } = conversation;

      // Active calls should have peek info, but TypeScript doesn't know that so we have a
      //   fallback.
      const {
        peekInfo = {
          deviceCount: 0,
          maxDevices: Infinity,
          acis: [],
        },
      } = call;

      for (let i = 0; i < memberships.length; i += 1) {
        const { aci } = memberships[i];

        const member = conversationSelector(aci);
        if (!member) {
          log.error('Group member has no corresponding conversation');
          continue;
        }

        groupMembers.push(member);
      }

      for (let i = 0; i < call.remoteParticipants.length; i += 1) {
        const remoteParticipant = call.remoteParticipants[i];

        const remoteConversation = conversationSelectorByAci(
          remoteParticipant.aci
        );
        if (!remoteConversation) {
          log.error('Remote participant has no corresponding conversation');
          continue;
        }

        remoteParticipants.push({
          ...remoteConversation,
          aci: remoteParticipant.aci,
          demuxId: remoteParticipant.demuxId,
          hasRemoteAudio: remoteParticipant.hasRemoteAudio,
          hasRemoteVideo: remoteParticipant.hasRemoteVideo,
          isHandRaised: raisedHands.has(remoteParticipant.demuxId),
          presenting: remoteParticipant.presenting,
          sharingScreen: remoteParticipant.sharingScreen,
          speakerTime: remoteParticipant.speakerTime,
          videoAspectRatio: remoteParticipant.videoAspectRatio,
        });
        conversationsByDemuxId.set(
          remoteParticipant.demuxId,
          remoteConversation
        );
      }

      if (localDemuxId !== undefined) {
        conversationsByDemuxId.set(localDemuxId, getMe(state));
      }

      // Filter raisedHands to ensure valid demuxIds.
      raisedHands.forEach(demuxId => {
        if (!conversationsByDemuxId.has(demuxId)) {
          raisedHands.delete(demuxId);
        }
      });

      for (
        let i = 0;
        i < activeCallState.safetyNumberChangedAcis.length;
        i += 1
      ) {
        const aci = activeCallState.safetyNumberChangedAcis[i];

        const remoteConversation = conversationSelectorByAci(aci);
        if (!remoteConversation) {
          log.error('Remote participant has no corresponding conversation');
          continue;
        }

        conversationsWithSafetyNumberChanges.push(remoteConversation);
      }

      for (let i = 0; i < peekInfo.acis.length; i += 1) {
        const peekedParticipantAci = peekInfo.acis[i];

        const peekedConversation =
          conversationSelectorByAci(peekedParticipantAci);
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
        conversationsByDemuxId,
        deviceCount: peekInfo.deviceCount,
        groupMembers,
        isConversationTooBigToRing: isConversationTooBigToRing(conversation),
        joinState: call.joinState,
        localDemuxId,
        maxDevices: peekInfo.maxDevices,
        peekedParticipants,
        raisedHands,
        remoteParticipants,
        remoteAudioLevels: call.remoteAudioLevels || new Map<number, number>(),
      } satisfies ActiveGroupCallType;
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
      if (!call.ringerAci) {
        log.error('The incoming group call has no ring state');
        return undefined;
      }

      const conversationSelector = getConversationSelector(state);
      const ringer = conversationSelector(call.ringerAci);
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

const mapStateToProps = (state: StateType) => {
  const incomingCall = mapStateToIncomingCallProp(state);

  return {
    activeCall: mapStateToActiveCallProp(state),
    bounceAppIconStart,
    bounceAppIconStop,
    availableCameras: state.calling.availableCameras,
    getGroupCallVideoFrameSource,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    isGroupCallOutboundRingEnabled: isGroupCallOutboundRingEnabled(),
    isGroupCallRaiseHandEnabled: isGroupCallRaiseHandEnabled(),
    isGroupCallReactionsEnabled: isGroupCallReactionsEnabled(),
    incomingCall,
    me: getMe(state),
    notifyForCall,
    playRingtone,
    stopRingtone,
    renderEmojiPicker,
    renderReactionPicker,
    renderDeviceSelection,
    renderSafetyNumberViewer,
    theme: getTheme(state),
    isConversationTooBigToRing: incomingCall
      ? isConversationTooBigToRing(incomingCall.conversation)
      : false,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
