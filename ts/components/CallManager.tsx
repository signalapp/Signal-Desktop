// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import { CallingPip } from './CallingPip';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen';
import { CallingLobby } from './CallingLobby';
import { CallScreen } from './CallScreen';
import { IncomingCallBar } from './IncomingCallBar';
import {
  CallMode,
  CallState,
  CallEndedReason,
  CanvasVideoRenderer,
  VideoFrameSource,
  GroupCallJoinState,
} from '../types/Calling';
import { ConversationType } from '../state/ducks/conversations';
import {
  AcceptCallType,
  ActiveCallStateType,
  CancelCallType,
  DeclineCallType,
  DirectCallStateType,
  GroupCallStateType,
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

interface ActiveCallType {
  call: DirectCallStateType | GroupCallStateType;
  activeCallState: ActiveCallStateType;
  conversation: ConversationType;
}

export interface PropsType {
  activeCall?: ActiveCallType;
  availableCameras: Array<MediaDeviceInfo>;
  cancelCall: (_: CancelCallType) => void;
  createCanvasVideoRenderer: () => CanvasVideoRenderer;
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
  createCanvasVideoRenderer,
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
  const { call, activeCallState, conversation } = activeCall;
  const {
    joinedAt,
    hasLocalAudio,
    hasLocalVideo,
    settingsDialogOpen,
    pip,
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
    return (
      <>
        <CallingLobby
          availableCameras={availableCameras}
          conversation={conversation}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          // TODO: Set this to `true` for group calls. We can get away with this for
          //   now because it only affects rendering. See DESKTOP-888 and DESKTOP-889.
          isGroupCall={false}
          me={me}
          onCallCanceled={cancelActiveCall}
          onJoinCall={joinActiveCall}
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

  // TODO: Group calls should also support the PiP. See DESKTOP-886.
  if (pip && call.callMode === CallMode.Direct) {
    const hasRemoteVideo = Boolean(call.hasRemoteVideo);

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
        call={call}
        conversation={conversation}
        createCanvasVideoRenderer={createCanvasVideoRenderer}
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
        togglePip={togglePip}
        toggleSettings={toggleSettings}
      />
      {settingsDialogOpen && renderDeviceSelection()}
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
