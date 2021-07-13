// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen';
import { CallScreen } from './CallScreen';
import { CallingLobby } from './CallingLobby';
import { CallingParticipantsList } from './CallingParticipantsList';
import { CallingSelectPresentingSourcesModal } from './CallingSelectPresentingSourcesModal';
import { CallingPip } from './CallingPip';
import { IncomingCallBar } from './IncomingCallBar';
import {
  SafetyNumberChangeDialog,
  SafetyNumberProps,
} from './SafetyNumberChangeDialog';
import {
  ActiveCallType,
  CallEndedReason,
  CallMode,
  CallState,
  GroupCallJoinState,
  GroupCallVideoRequest,
  PresentedSource,
  VideoFrameSource,
} from '../types/Calling';
import { ConversationType } from '../state/ducks/conversations';
import {
  AcceptCallType,
  CancelCallType,
  DeclineCallType,
  DirectCallStateType,
  HangUpType,
  KeyChangeOkType,
  SetGroupCallVideoRequestType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
  StartCallType,
} from '../state/ducks/calling';
import { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';

type MeType = ConversationType & {
  uuid: string;
};

export type PropsType = {
  activeCall?: ActiveCallType;
  availableCameras: Array<MediaDeviceInfo>;
  cancelCall: (_: CancelCallType) => void;
  closeNeedPermissionScreen: () => void;
  getGroupCallVideoFrameSource: (
    conversationId: string,
    demuxId: number
  ) => VideoFrameSource;
  getPresentingSources: () => void;
  incomingCall?: {
    call: DirectCallStateType;
    conversation: ConversationType;
  };
  keyChangeOk: (_: KeyChangeOkType) => void;
  renderDeviceSelection: () => JSX.Element;
  renderSafetyNumberViewer: (props: SafetyNumberProps) => JSX.Element;
  startCall: (payload: StartCallType) => void;
  toggleParticipants: () => void;
  acceptCall: (_: AcceptCallType) => void;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  me: MeType;
  openSystemPreferencesAction: () => unknown;
  setGroupCallVideoRequest: (_: SetGroupCallVideoRequestType) => void;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setPresenting: (_?: PresentedSource) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  hangUp: (_: HangUpType) => void;
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
  hangUp,
  i18n,
  keyChangeOk,
  getGroupCallVideoFrameSource,
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
  startCall,
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
      break;
    }
    case CallMode.Group: {
      showCallLobby = activeCall.joinState === GroupCallJoinState.NotJoined;
      isCallFull = activeCall.deviceCount >= activeCall.maxDevices;
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
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          isGroupCall={activeCall.callMode === CallMode.Group}
          isCallFull={isCallFull}
          me={me}
          onCallCanceled={cancelActiveCall}
          onJoinCall={joinActiveCall}
          peekedParticipants={peekedParticipants}
          setLocalPreview={setLocalPreview}
          setLocalAudio={setLocalAudio}
          setLocalVideo={setLocalVideo}
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
        hangUp={hangUp}
        hasLocalVideo={hasLocalVideo}
        i18n={i18n}
        setGroupCallVideoRequest={setGroupCallVideoRequestForConversation}
        setLocalPreview={setLocalPreview}
        setRendererCanvas={setRendererCanvas}
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
        hangUp={hangUp}
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
          i18n={i18n}
          onCancel={() => {
            hangUp({ conversationId: activeCall.conversation.id });
          }}
          onConfirm={() => {
            keyChangeOk({ conversationId: activeCall.conversation.id });
          }}
          renderSafetyNumber={renderSafetyNumberViewer}
        />
      ) : null}
    </>
  );
};

export const CallManager: React.FC<PropsType> = props => {
  const { activeCall, incomingCall, acceptCall, declineCall, i18n } = props;

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
        declineCall={declineCall}
        i18n={i18n}
        call={incomingCall.call}
        conversation={incomingCall.conversation}
      />
    );
  }

  return null;
};
