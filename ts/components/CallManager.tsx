// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect } from 'react';
import { noop } from 'lodash';
import type { VideoFrameSource } from 'ringrtc';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen';
import { CallScreen } from './CallScreen';
import { CallingLobby } from './CallingLobby';
import { CallingParticipantsList } from './CallingParticipantsList';
import { CallingSelectPresentingSourcesModal } from './CallingSelectPresentingSourcesModal';
import { CallingPip } from './CallingPip';
import { IncomingCallBar } from './IncomingCallBar';
import type { SafetyNumberProps } from './SafetyNumberChangeDialog';
import { SafetyNumberChangeDialog } from './SafetyNumberChangeDialog';
import type {
  ActiveCallType,
  GroupCallVideoRequest,
  PresentedSource,
} from '../types/Calling';
import {
  CallEndedReason,
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type {
  AcceptCallType,
  CancelCallType,
  DeclineCallType,
  KeyChangeOkType,
  SetGroupCallVideoRequestType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
  StartCallType,
} from '../state/ducks/calling';
import type { LocalizerType, ThemeType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';

const GROUP_CALL_RING_DURATION = 60 * 1000;

export type PropsType = {
  activeCall?: ActiveCallType;
  availableCameras: Array<MediaDeviceInfo>;
  cancelCall: (_: CancelCallType) => void;
  closeNeedPermissionScreen: () => void;
  getGroupCallVideoFrameSource: (
    conversationId: string,
    demuxId: number
  ) => VideoFrameSource;
  getPreferredBadge: PreferredBadgeSelectorType;
  getPresentingSources: () => void;
  incomingCall?:
    | {
        callMode: CallMode.Direct;
        conversation: ConversationType;
        isVideoCall: boolean;
      }
    | {
        callMode: CallMode.Group;
        conversation: ConversationType;
        otherMembersRung: Array<Pick<ConversationType, 'firstName' | 'title'>>;
        ringer: Pick<ConversationType, 'firstName' | 'title'>;
      };
  keyChangeOk: (_: KeyChangeOkType) => void;
  renderDeviceSelection: () => JSX.Element;
  renderSafetyNumberViewer: (props: SafetyNumberProps) => JSX.Element;
  startCall: (payload: StartCallType) => void;
  toggleParticipants: () => void;
  acceptCall: (_: AcceptCallType) => void;
  bounceAppIconStart: () => unknown;
  bounceAppIconStop: () => unknown;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  isGroupCallOutboundRingEnabled: boolean;
  me: ConversationType;
  notifyForCall: (title: string, isVideoCall: boolean) => unknown;
  openSystemPreferencesAction: () => unknown;
  playRingtone: () => unknown;
  setGroupCallVideoRequest: (_: SetGroupCallVideoRequestType) => void;
  setIsCallActive: (_: boolean) => void;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setOutgoingRing: (_: boolean) => void;
  setPresenting: (_?: PresentedSource) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  stopRingtone: () => unknown;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
  hangUpActiveCall: () => void;
  theme: ThemeType;
  togglePip: () => void;
  toggleScreenRecordingPermissionsDialog: () => unknown;
  toggleSettings: () => void;
  toggleSpeakerView: () => void;
};

type ActiveCallManagerPropsType = PropsType & {
  activeCall: ActiveCallType;
};

const ActiveCallManager: React.FC<ActiveCallManagerPropsType> = ({
  activeCall,
  availableCameras,
  cancelCall,
  closeNeedPermissionScreen,
  hangUpActiveCall,
  i18n,
  isGroupCallOutboundRingEnabled,
  keyChangeOk,
  getGroupCallVideoFrameSource,
  getPreferredBadge,
  getPresentingSources,
  me,
  openSystemPreferencesAction,
  renderDeviceSelection,
  renderSafetyNumberViewer,
  setGroupCallVideoRequest,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  setPresenting,
  setRendererCanvas,
  setOutgoingRing,
  startCall,
  switchToPresentationView,
  switchFromPresentationView,
  theme,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSettings,
  toggleSpeakerView,
}) => {
  const {
    conversation,
    hasLocalAudio,
    hasLocalVideo,
    joinedAt,
    peekedParticipants,
    pip,
    presentingSourcesAvailable,
    settingsDialogOpen,
    showParticipantsList,
    outgoingRing,
  } = activeCall;

  const cancelActiveCall = useCallback(() => {
    cancelCall({ conversationId: conversation.id });
  }, [cancelCall, conversation.id]);

  const joinActiveCall = useCallback(() => {
    startCall({
      callMode: activeCall.callMode,
      conversationId: conversation.id,
      hasLocalAudio,
      hasLocalVideo,
    });
  }, [
    startCall,
    activeCall.callMode,
    conversation.id,
    hasLocalAudio,
    hasLocalVideo,
  ]);

  const getGroupCallVideoFrameSourceForActiveCall = useCallback(
    (demuxId: number) => {
      return getGroupCallVideoFrameSource(conversation.id, demuxId);
    },
    [getGroupCallVideoFrameSource, conversation.id]
  );

  const setGroupCallVideoRequestForConversation = useCallback(
    (resolutions: Array<GroupCallVideoRequest>) => {
      setGroupCallVideoRequest({
        conversationId: conversation.id,
        resolutions,
      });
    },
    [setGroupCallVideoRequest, conversation.id]
  );

  let isCallFull: boolean;
  let showCallLobby: boolean;
  let groupMembers:
    | undefined
    | Array<Pick<ConversationType, 'id' | 'firstName' | 'title'>>;

  switch (activeCall.callMode) {
    case CallMode.Direct: {
      const { callState, callEndedReason } = activeCall;
      const ended = callState === CallState.Ended;
      if (
        ended &&
        callEndedReason === CallEndedReason.RemoteHangupNeedPermission
      ) {
        return (
          <CallNeedPermissionScreen
            close={closeNeedPermissionScreen}
            conversation={conversation}
            i18n={i18n}
          />
        );
      }
      showCallLobby = !callState;
      isCallFull = false;
      groupMembers = undefined;
      break;
    }
    case CallMode.Group: {
      showCallLobby = activeCall.joinState !== GroupCallJoinState.Joined;
      isCallFull = activeCall.deviceCount >= activeCall.maxDevices;
      ({ groupMembers } = activeCall);
      break;
    }
    default:
      throw missingCaseError(activeCall);
  }

  if (showCallLobby) {
    return (
      <>
        <CallingLobby
          availableCameras={availableCameras}
          conversation={conversation}
          groupMembers={groupMembers}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          isGroupCall={activeCall.callMode === CallMode.Group}
          isGroupCallOutboundRingEnabled={isGroupCallOutboundRingEnabled}
          isCallFull={isCallFull}
          me={me}
          onCallCanceled={cancelActiveCall}
          onJoinCall={joinActiveCall}
          outgoingRing={outgoingRing}
          peekedParticipants={peekedParticipants}
          setLocalPreview={setLocalPreview}
          setLocalAudio={setLocalAudio}
          setLocalVideo={setLocalVideo}
          setOutgoingRing={setOutgoingRing}
          showParticipantsList={showParticipantsList}
          toggleParticipants={toggleParticipants}
          toggleSettings={toggleSettings}
        />
        {settingsDialogOpen && renderDeviceSelection()}
        {showParticipantsList && activeCall.callMode === CallMode.Group ? (
          <CallingParticipantsList
            i18n={i18n}
            onClose={toggleParticipants}
            ourUuid={me.uuid}
            participants={peekedParticipants}
          />
        ) : null}
      </>
    );
  }

  if (pip) {
    return (
      <CallingPip
        activeCall={activeCall}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        hangUpActiveCall={hangUpActiveCall}
        hasLocalVideo={hasLocalVideo}
        i18n={i18n}
        setGroupCallVideoRequest={setGroupCallVideoRequestForConversation}
        setLocalPreview={setLocalPreview}
        setRendererCanvas={setRendererCanvas}
        switchToPresentationView={switchToPresentationView}
        switchFromPresentationView={switchFromPresentationView}
        togglePip={togglePip}
      />
    );
  }

  const groupCallParticipantsForParticipantsList =
    activeCall.callMode === CallMode.Group
      ? [
          ...activeCall.remoteParticipants.map(participant => ({
            ...participant,
            hasRemoteAudio: participant.hasRemoteAudio,
            hasRemoteVideo: participant.hasRemoteVideo,
            presenting: participant.presenting,
          })),
          {
            ...me,
            hasRemoteAudio: hasLocalAudio,
            hasRemoteVideo: hasLocalVideo,
            presenting: Boolean(activeCall.presentingSource),
          },
        ]
      : [];

  return (
    <>
      <CallScreen
        activeCall={activeCall}
        getPresentingSources={getPresentingSources}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        groupMembers={groupMembers}
        hangUpActiveCall={hangUpActiveCall}
        i18n={i18n}
        joinedAt={joinedAt}
        me={me}
        openSystemPreferencesAction={openSystemPreferencesAction}
        setGroupCallVideoRequest={setGroupCallVideoRequestForConversation}
        setLocalPreview={setLocalPreview}
        setRendererCanvas={setRendererCanvas}
        setLocalAudio={setLocalAudio}
        setLocalVideo={setLocalVideo}
        setPresenting={setPresenting}
        stickyControls={showParticipantsList}
        switchToPresentationView={switchToPresentationView}
        switchFromPresentationView={switchFromPresentationView}
        toggleScreenRecordingPermissionsDialog={
          toggleScreenRecordingPermissionsDialog
        }
        toggleParticipants={toggleParticipants}
        togglePip={togglePip}
        toggleSettings={toggleSettings}
        toggleSpeakerView={toggleSpeakerView}
      />
      {presentingSourcesAvailable && presentingSourcesAvailable.length ? (
        <CallingSelectPresentingSourcesModal
          i18n={i18n}
          presentingSourcesAvailable={presentingSourcesAvailable}
          setPresenting={setPresenting}
        />
      ) : null}
      {settingsDialogOpen && renderDeviceSelection()}
      {showParticipantsList && activeCall.callMode === CallMode.Group ? (
        <CallingParticipantsList
          i18n={i18n}
          onClose={toggleParticipants}
          ourUuid={me.uuid}
          participants={groupCallParticipantsForParticipantsList}
        />
      ) : null}
      {activeCall.callMode === CallMode.Group &&
      activeCall.conversationsWithSafetyNumberChanges.length ? (
        <SafetyNumberChangeDialog
          confirmText={i18n('continueCall')}
          contacts={activeCall.conversationsWithSafetyNumberChanges}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          onCancel={hangUpActiveCall}
          onConfirm={() => {
            keyChangeOk({ conversationId: activeCall.conversation.id });
          }}
          renderSafetyNumber={renderSafetyNumberViewer}
          theme={theme}
        />
      ) : null}
    </>
  );
};

export const CallManager: React.FC<PropsType> = props => {
  const {
    acceptCall,
    activeCall,
    bounceAppIconStart,
    bounceAppIconStop,
    declineCall,
    i18n,
    incomingCall,
    notifyForCall,
    playRingtone,
    stopRingtone,
    setIsCallActive,
    setOutgoingRing,
  } = props;

  const isCallActive = Boolean(activeCall);
  useEffect(() => {
    setIsCallActive(isCallActive);
  }, [isCallActive, setIsCallActive]);

  const shouldRing = getShouldRing(props);
  useEffect(() => {
    if (shouldRing) {
      playRingtone();
      return () => {
        stopRingtone();
      };
    }

    stopRingtone();
    return noop;
  }, [shouldRing, playRingtone, stopRingtone]);

  const mightBeRingingOutgoingGroupCall =
    activeCall?.callMode === CallMode.Group &&
    activeCall.outgoingRing &&
    activeCall.joinState !== GroupCallJoinState.NotJoined;
  useEffect(() => {
    if (!mightBeRingingOutgoingGroupCall) {
      return noop;
    }

    const timeout = setTimeout(() => {
      setOutgoingRing(false);
    }, GROUP_CALL_RING_DURATION);
    return () => {
      clearTimeout(timeout);
    };
  }, [mightBeRingingOutgoingGroupCall, setOutgoingRing]);

  if (activeCall) {
    // `props` should logically have an `activeCall` at this point, but TypeScript can't
    //   figure that out, so we pass it in again.
    return <ActiveCallManager {...props} activeCall={activeCall} />;
  }

  // In the future, we may want to show the incoming call bar when a call is active.
  if (incomingCall) {
    return (
      <IncomingCallBar
        acceptCall={acceptCall}
        bounceAppIconStart={bounceAppIconStart}
        bounceAppIconStop={bounceAppIconStop}
        declineCall={declineCall}
        i18n={i18n}
        notifyForCall={notifyForCall}
        {...incomingCall}
      />
    );
  }

  return null;
};

function getShouldRing({
  activeCall,
  incomingCall,
}: Readonly<Pick<PropsType, 'activeCall' | 'incomingCall'>>): boolean {
  if (incomingCall) {
    return !activeCall;
  }

  if (!activeCall) {
    return false;
  }

  switch (activeCall.callMode) {
    case CallMode.Direct:
      return (
        activeCall.callState === CallState.Prering ||
        activeCall.callState === CallState.Ringing
      );
    case CallMode.Group:
      return (
        activeCall.outgoingRing &&
        (activeCall.connectionState === GroupCallConnectionState.Connecting ||
          activeCall.connectionState === GroupCallConnectionState.Connected) &&
        activeCall.joinState !== GroupCallJoinState.NotJoined &&
        !activeCall.remoteParticipants.length &&
        (activeCall.conversation.sortedGroupMembers || []).length >= 2
      );
    default:
      throw missingCaseError(activeCall);
  }
}
