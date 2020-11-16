// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { CallingPip } from './CallingPip';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen';
import { CallingLobby } from './CallingLobby';
import { CallScreen } from './CallScreen';
import { IncomingCallBar } from './IncomingCallBar';
import { CallState, CallEndedReason } from '../types/Calling';
import {
  ActiveCallStateType,
  AcceptCallType,
  DeclineCallType,
  DirectCallStateType,
  StartCallType,
  SetLocalAudioType,
  HangUpType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
} from '../state/ducks/calling';
import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';

interface PropsType {
  activeCall?: {
    call: DirectCallStateType;
    activeCallState: ActiveCallStateType;
    conversation: {
      id: string;
      avatarPath?: string;
      color?: ColorType;
      title: string;
      name?: string;
      phoneNumber?: string;
      profileName?: string;
    };
  };
  availableCameras: Array<MediaDeviceInfo>;
  cancelCall: () => void;
  closeNeedPermissionScreen: () => void;
  incomingCall?: {
    call: DirectCallStateType;
    conversation: {
      id: string;
      avatarPath?: string;
      color?: ColorType;
      title: string;
      name?: string;
      phoneNumber?: string;
      profileName?: string;
    };
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

export const CallManager = ({
  acceptCall,
  activeCall,
  availableCameras,
  cancelCall,
  closeNeedPermissionScreen,
  declineCall,
  hangUp,
  i18n,
  incomingCall,
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
}: PropsType): JSX.Element | null => {
  if (activeCall) {
    const { call, activeCallState, conversation } = activeCall;
    const { callState, callEndedReason } = call;
    const {
      joinedAt,
      hasLocalAudio,
      hasLocalVideo,
      settingsDialogOpen,
      pip,
    } = activeCallState;

    const ended = callState === CallState.Ended;
    if (ended) {
      if (callEndedReason === CallEndedReason.RemoteHangupNeedPermission) {
        return (
          <CallNeedPermissionScreen
            close={closeNeedPermissionScreen}
            conversation={conversation}
            i18n={i18n}
          />
        );
      }
    }

    if (!callState) {
      return (
        <>
          <CallingLobby
            availableCameras={availableCameras}
            conversation={conversation}
            hasLocalAudio={hasLocalAudio}
            hasLocalVideo={hasLocalVideo}
            i18n={i18n}
            isGroupCall={false}
            me={me}
            onCallCanceled={cancelCall}
            onJoinCall={() => {
              startCall({
                conversationId: conversation.id,
                hasLocalAudio,
                hasLocalVideo,
              });
            }}
            setLocalPreview={setLocalPreview}
            setLocalAudio={setLocalAudio}
            setLocalVideo={setLocalVideo}
            toggleParticipants={toggleParticipants}
            toggleSettings={toggleSettings}
          />
          {settingsDialogOpen && renderDeviceSelection()}
        </>
      );
    }

    const hasRemoteVideo = Boolean(call.hasRemoteVideo);

    if (pip) {
      return (
        <CallingPip
          conversation={conversation}
          hangUp={hangUp}
          hasLocalVideo={hasLocalVideo}
          hasRemoteVideo={hasRemoteVideo}
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
          conversation={conversation}
          callState={callState}
          hangUp={hangUp}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          joinedAt={joinedAt}
          me={me}
          hasRemoteVideo={hasRemoteVideo}
          setLocalPreview={setLocalPreview}
          setRendererCanvas={setRendererCanvas}
          setLocalAudio={setLocalAudio}
          setLocalVideo={setLocalVideo}
          togglePip={togglePip}
          toggleSettings={toggleSettings}
        />
        {settingsDialogOpen && renderDeviceSelection()}
      </>
    );
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
