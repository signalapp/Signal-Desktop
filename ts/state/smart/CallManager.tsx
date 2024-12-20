// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memoize } from 'lodash';
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type {
  DirectIncomingCall,
  GroupIncomingCall,
} from '../../components/CallManager';
import { CallManager } from '../../components/CallManager';
import { isConversationTooBigToRing as getIsConversationTooBigToRing } from '../../conversations/isConversationTooBigToRing';
import * as log from '../../logging/log';
import { calling as callingService } from '../../services/calling';
import {
  FALLBACK_NOTIFICATION_TITLE,
  NotificationSetting,
  NotificationType,
  notificationService,
} from '../../services/notifications';
import {
  bounceAppIconStart,
  bounceAppIconStop,
} from '../../shims/bounceAppIcon';
import type { CallLinkType } from '../../types/CallLink';
import type {
  ActiveCallBaseType,
  ActiveCallType,
  ActiveDirectCallType,
  ActiveGroupCallType,
  CallingConversationType,
  ConversationsByDemuxIdType,
  GroupCallRemoteParticipantType,
} from '../../types/Calling';
import { CallState } from '../../types/Calling';
import { CallMode } from '../../types/CallDisposition';
import type { AciString } from '../../types/ServiceId';
import { strictAssert } from '../../util/assert';
import { callLinkToConversation } from '../../util/callLinks';
import { callingTones } from '../../util/callingTones';
import { missingCaseError } from '../../util/missingCaseError';
import { useAudioPlayerActions } from '../ducks/audioPlayer';
import { getActiveCall, useCallingActions } from '../ducks/calling';
import type { ConversationType } from '../ducks/conversations';
import type { StateType } from '../reducer';
import { getHasInitialLoadCompleted } from '../selectors/app';
import {
  getActiveCallState,
  getAvailableCameras,
  getCallLinkSelector,
  getRingingCall,
} from '../selectors/calling';
import { getConversationSelector, getMe } from '../selectors/conversations';
import { getIntl, getUserACI } from '../selectors/user';
import { SmartCallingDeviceSelection } from './CallingDeviceSelection';
import { renderEmojiPicker } from './renderEmojiPicker';
import { renderReactionPicker } from './renderReactionPicker';
import { isSharingPhoneNumberWithEverybody as getIsSharingPhoneNumberWithEverybody } from '../../util/phoneNumberSharingMode';
import { useGlobalModalActions } from '../ducks/globalModals';
import { isLonelyGroup } from '../ducks/callingHelpers';

function renderDeviceSelection(): JSX.Element {
  return <SmartCallingDeviceSelection />;
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

function setLocalPreviewContainer(container: HTMLDivElement | null): void {
  callingService.setLocalPreviewContainer(container);
}

const playRingtone = callingTones.playRingtone.bind(callingTones);
const stopRingtone = callingTones.stopRingtone.bind(callingTones);

const mapStateToActiveCallProp = (
  state: StateType
): undefined | ActiveCallType => {
  const { calling } = state;
  const activeCallState = getActiveCallState(state);

  if (!activeCallState) {
    return undefined;
  }

  const call = getActiveCall(calling);
  if (!call) {
    log.error('There was an active call state but no corresponding call');
    return undefined;
  }

  const conversationSelector = getConversationSelector(state);
  let conversation: CallingConversationType;
  if (call.callMode === CallMode.Adhoc) {
    const callLinkSelector = getCallLinkSelector(state);
    const callLink = callLinkSelector(activeCallState.conversationId);
    if (!callLink) {
      // An error is logged in mapStateToCallLinkProp
      return undefined;
    }

    conversation = callLinkToConversation(callLink, window.i18n);
  } else {
    conversation = conversationSelector(activeCallState.conversationId);
  }
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
    case CallMode.Group:
    case CallMode.Adhoc: {
      const groupMembers: Array<ConversationType> = [];
      const remoteParticipants: Array<GroupCallRemoteParticipantType> = [];
      const peekedParticipants: Array<ConversationType> = [];
      const pendingParticipants: Array<ConversationType> = [];
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
          pendingAcis: [],
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
          addedTime: remoteParticipant.addedTime,
          demuxId: remoteParticipant.demuxId,
          hasRemoteAudio: remoteParticipant.hasRemoteAudio,
          hasRemoteVideo: remoteParticipant.hasRemoteVideo,
          isHandRaised: raisedHands.has(remoteParticipant.demuxId),
          mediaKeysReceived: remoteParticipant.mediaKeysReceived,
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

      for (let i = 0; i < peekInfo.pendingAcis.length; i += 1) {
        const aci = peekInfo.pendingAcis[i];

        // In call links, pending users may be unknown until they share profile keys.
        // conversationSelectorByAci should create conversations for new contacts.
        const pendingConversation = conversationSelectorByAci(aci);
        if (!pendingConversation) {
          log.error('Pending participant has no corresponding conversation');
          continue;
        }

        pendingParticipants.push(pendingConversation);
      }

      return {
        ...baseResult,
        callMode: call.callMode,
        connectionState: call.connectionState,
        conversationsByDemuxId,
        deviceCount: peekInfo.deviceCount,
        groupMembers,
        isConversationTooBigToRing: getIsConversationTooBigToRing(conversation),
        joinState: call.joinState,
        localDemuxId,
        maxDevices: peekInfo.maxDevices,
        peekedParticipants,
        pendingParticipants,
        raisedHands,
        remoteParticipants,
        remoteAudioLevels: call.remoteAudioLevels || new Map<number, number>(),
        suggestLowerHand: Boolean(activeCallState.suggestLowerHand),
      } satisfies ActiveGroupCallType;
    }
    default:
      throw missingCaseError(call);
  }
};

const mapStateToCallLinkProp = (state: StateType): CallLinkType | undefined => {
  const { calling } = state;
  const { activeCallState } = calling;

  if (!activeCallState) {
    return;
  }

  const call = getActiveCall(calling);
  if (call?.callMode !== CallMode.Adhoc) {
    return;
  }

  const callLinkSelector = getCallLinkSelector(state);
  const callLink = callLinkSelector(activeCallState.conversationId);
  if (!callLink) {
    log.error(
      'Active call referred to a call link but no corresponding call link in state.'
    );
    return;
  }

  return callLink;
};

const mapStateToRingingCallProp = (
  state: StateType
): DirectIncomingCall | GroupIncomingCall | null => {
  const ourAci = getUserACI(state);
  const ringingCall = getRingingCall(state);
  if (!ringingCall) {
    return null;
  }

  const conversation = getConversationSelector(state)(
    ringingCall.conversationId
  );
  if (!conversation) {
    log.error('The incoming call has no corresponding conversation');
    return null;
  }

  switch (ringingCall.callMode) {
    case CallMode.Direct:
      return {
        callMode: CallMode.Direct as const,
        callState: ringingCall.callState,
        callEndedReason: ringingCall.callEndedReason,
        conversation,
        isVideoCall: ringingCall.isVideoCall,
      };
    case CallMode.Group: {
      if (getIsConversationTooBigToRing(conversation)) {
        return null;
      }

      if (isLonelyGroup(conversation)) {
        return null;
      }

      const conversationSelector = getConversationSelector(state);
      const ringer = conversationSelector(ringingCall.ringerAci || ourAci);
      const otherMembersRung = (conversation.sortedGroupMembers ?? []).filter(
        c => c.id !== ringer.id && !c.isMe
      );

      return {
        callMode: CallMode.Group as const,
        connectionState: ringingCall.connectionState,
        joinState: ringingCall.joinState,
        conversation,
        otherMembersRung,
        ringer,
        remoteParticipants: ringingCall.remoteParticipants,
      };
    }
    case CallMode.Adhoc:
      log.error('Cannot handle an incoming adhoc call');
      return null;
    default:
      throw missingCaseError(ringingCall);
  }
};

export const SmartCallManager = memo(function SmartCallManager() {
  const i18n = useSelector(getIntl);
  const activeCall = useSelector(mapStateToActiveCallProp);
  const callLink = useSelector(mapStateToCallLinkProp);
  const ringingCall = useSelector(mapStateToRingingCallProp);
  const availableCameras = useSelector(getAvailableCameras);
  const hasInitialLoadCompleted = useSelector(getHasInitialLoadCompleted);
  const me = useSelector(getMe);

  const {
    approveUser,
    batchUserAction,
    denyUser,
    changeCallView,
    closeNeedPermissionScreen,
    getPresentingSources,
    cancelCall,
    startCall,
    toggleParticipants,
    acceptCall,
    declineCall,
    openSystemPreferencesAction,
    removeClient,
    blockClient,
    cancelPresenting,
    sendGroupCallRaiseHand,
    sendGroupCallReaction,
    selectPresentingSource,
    setGroupCallVideoRequest,
    setIsCallActive,
    setLocalAudio,
    setLocalVideo,
    setOutgoingRing,
    setRendererCanvas,
    switchToPresentationView,
    switchFromPresentationView,
    hangUpActiveCall,
    togglePip,
    toggleScreenRecordingPermissionsDialog,
    toggleSettings,
  } = useCallingActions();
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();
  const {
    showContactModal,
    showShareCallLinkViaSignal,
    toggleCallLinkPendingParticipantModal,
  } = useGlobalModalActions();

  return (
    <CallManager
      acceptCall={acceptCall}
      activeCall={activeCall}
      approveUser={approveUser}
      availableCameras={availableCameras}
      batchUserAction={batchUserAction}
      blockClient={blockClient}
      bounceAppIconStart={bounceAppIconStart}
      bounceAppIconStop={bounceAppIconStop}
      callLink={callLink}
      cancelCall={cancelCall}
      cancelPresenting={cancelPresenting}
      changeCallView={changeCallView}
      closeNeedPermissionScreen={closeNeedPermissionScreen}
      declineCall={declineCall}
      denyUser={denyUser}
      getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
      getIsSharingPhoneNumberWithEverybody={
        getIsSharingPhoneNumberWithEverybody
      }
      getPresentingSources={getPresentingSources}
      hangUpActiveCall={hangUpActiveCall}
      hasInitialLoadCompleted={hasInitialLoadCompleted}
      i18n={i18n}
      me={me}
      notifyForCall={notifyForCall}
      openSystemPreferencesAction={openSystemPreferencesAction}
      pauseVoiceNotePlayer={pauseVoiceNotePlayer}
      playRingtone={playRingtone}
      removeClient={removeClient}
      renderDeviceSelection={renderDeviceSelection}
      renderEmojiPicker={renderEmojiPicker}
      renderReactionPicker={renderReactionPicker}
      ringingCall={ringingCall}
      sendGroupCallRaiseHand={sendGroupCallRaiseHand}
      sendGroupCallReaction={sendGroupCallReaction}
      selectPresentingSource={selectPresentingSource}
      setGroupCallVideoRequest={setGroupCallVideoRequest}
      setIsCallActive={setIsCallActive}
      setLocalAudio={setLocalAudio}
      setLocalPreviewContainer={setLocalPreviewContainer}
      setLocalVideo={setLocalVideo}
      setOutgoingRing={setOutgoingRing}
      setRendererCanvas={setRendererCanvas}
      showContactModal={showContactModal}
      showShareCallLinkViaSignal={showShareCallLinkViaSignal}
      startCall={startCall}
      stopRingtone={stopRingtone}
      switchFromPresentationView={switchFromPresentationView}
      switchToPresentationView={switchToPresentationView}
      toggleCallLinkPendingParticipantModal={
        toggleCallLinkPendingParticipantModal
      }
      toggleParticipants={toggleParticipants}
      togglePip={togglePip}
      toggleScreenRecordingPermissionsDialog={
        toggleScreenRecordingPermissionsDialog
      }
      toggleSettings={toggleSettings}
    />
  );
});
