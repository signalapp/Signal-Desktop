// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen';
import { CallScreen } from './CallScreen';
import { CallingLobby } from './CallingLobby';
import { CallingParticipantsList } from './CallingParticipantsList';
import { CallingPip } from './CallingPip';
import { IncomingCallBar } from './IncomingCallBar';
import {
  CallEndedReason,
  CallMode,
  CallState,
  GroupCallJoinState,
  VideoFrameSource,
} from '../types/Calling';
import { ConversationType } from '../state/ducks/conversations';
import {
  AcceptCallType,
  ActiveCallType,
  CancelCallType,
  DeclineCallType,
  DirectCallStateType,
  HangUpType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
  StartCallType,
} from '../state/ducks/calling';
import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';
import { missingCaseError } from '../util/missingCaseError';

export interface PropsType {
  activeCall?: ActiveCallType;
  availableCameras: Array<MediaDeviceInfo>;
  cancelCall: (_: CancelCallType) => void;
  closeNeedPermissionScreen: () => void;
  getGroupCallVideoFrameSource: (
    conversationId: string,
    demuxId: number
  ) => VideoFrameSource;
  incomingCall?: {
    call: DirectCallStateType;
    conversation: ConversationType;
  };
  renderDeviceSelection: () => JSX.Element;
  startCall: (payload: StartCallType) => void;
  toggleParticipants: () => void;
  acceptCall: (_: AcceptCallType) => void;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  me: {
    avatarPath?: string;
    color?: ColorType;
    name?: string;
    phoneNumber?: string;
    profileName?: string;
    title: string;
  };
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  hangUp: (_: HangUpType) => void;
  togglePip: () => void;
  toggleSettings: () => void;
}

interface ActiveCallManagerPropsType extends PropsType {
  activeCall: ActiveCallType;
}

const ActiveCallManager: React.FC<ActiveCallManagerPropsType> = ({
  activeCall,
  availableCameras,
  cancelCall,
  closeNeedPermissionScreen,
  hangUp,
  i18n,
  getGroupCallVideoFrameSource,
  me,
  renderDeviceSelection,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  setRendererCanvas,
  startCall,
  toggleParticipants,
  togglePip,
  toggleSettings,
}) => {
  const {
    call,
    activeCallState,
    conversation,
    groupCallPeekedParticipants,
    groupCallParticipants,
    isCallFull,
  } = activeCall;
  const {
    hasLocalAudio,
    hasLocalVideo,
    joinedAt,
    pip,
    settingsDialogOpen,
    showParticipantsList,
  } = activeCallState;

  const cancelActiveCall = useCallback(() => {
    cancelCall({ conversationId: conversation.id });
  }, [cancelCall, conversation.id]);

  const joinActiveCall = useCallback(() => {
    startCall({
      callMode: call.callMode,
      conversationId: conversation.id,
      hasLocalAudio,
      hasLocalVideo,
    });
  }, [startCall, call.callMode, conversation.id, hasLocalAudio, hasLocalVideo]);

  const getGroupCallVideoFrameSourceForActiveCall = useCallback(
    (demuxId: number) => {
      return getGroupCallVideoFrameSource(conversation.id, demuxId);
    },
    [getGroupCallVideoFrameSource, conversation.id]
  );

  let showCallLobby: boolean;

  switch (call.callMode) {
    case CallMode.Direct: {
      const { callState, callEndedReason } = call;
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
      break;
    }
    case CallMode.Group: {
      showCallLobby = call.joinState === GroupCallJoinState.NotJoined;
      break;
    }
    default:
      throw missingCaseError(call);
  }

  if (showCallLobby) {
    const participantNames = groupCallPeekedParticipants.map(participant =>
      participant.isSelf
        ? i18n('you')
        : participant.firstName || participant.title
    );
    return (
      <>
        <CallingLobby
          availableCameras={availableCameras}
          conversation={conversation}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          isGroupCall={call.callMode === CallMode.Group}
          isCallFull={isCallFull}
          me={me}
          onCallCanceled={cancelActiveCall}
          onJoinCall={joinActiveCall}
          participantNames={participantNames}
          setLocalPreview={setLocalPreview}
          setLocalAudio={setLocalAudio}
          setLocalVideo={setLocalVideo}
          showParticipantsList={showParticipantsList}
          toggleParticipants={toggleParticipants}
          toggleSettings={toggleSettings}
        />
        {settingsDialogOpen && renderDeviceSelection()}
        {showParticipantsList && call.callMode === CallMode.Group ? (
          <CallingParticipantsList
            i18n={i18n}
            onClose={toggleParticipants}
            participants={groupCallParticipants}
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
        setLocalPreview={setLocalPreview}
        setRendererCanvas={setRendererCanvas}
        togglePip={togglePip}
      />
    );
  }

  return (
    <>
      <CallScreen
        activeCall={activeCall}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        hangUp={hangUp}
        hasLocalAudio={hasLocalAudio}
        hasLocalVideo={hasLocalVideo}
        i18n={i18n}
        joinedAt={joinedAt}
        me={me}
        setLocalPreview={setLocalPreview}
        setRendererCanvas={setRendererCanvas}
        setLocalAudio={setLocalAudio}
        setLocalVideo={setLocalVideo}
        stickyControls={showParticipantsList}
        toggleParticipants={toggleParticipants}
        togglePip={togglePip}
        toggleSettings={toggleSettings}
      />
      {settingsDialogOpen && renderDeviceSelection()}
      {showParticipantsList && call.callMode === CallMode.Group ? (
        <CallingParticipantsList
          i18n={i18n}
          onClose={toggleParticipants}
          participants={groupCallParticipants}
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
