import React from 'react';
import { CallingPip } from './CallingPip';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen';
import { CallingLobby } from './CallingLobby';
import { CallScreen, PropsType as CallScreenPropsType } from './CallScreen';
import {
  IncomingCallBar,
  PropsType as IncomingCallBarPropsType,
} from './IncomingCallBar';
import { CallState, CallEndedReason } from '../types/Calling';
import { CallDetailsType, OutgoingCallType } from '../state/ducks/calling';

type CallManagerPropsType = {
  availableCameras: Array<MediaDeviceInfo>;
  callDetails?: CallDetailsType;
  callEndedReason?: CallEndedReason;
  callState?: CallState;
  cancelCall: () => void;
  pip: boolean;
  closeNeedPermissionScreen: () => void;
  renderDeviceSelection: () => JSX.Element;
  settingsDialogOpen: boolean;
  startCall: (payload: OutgoingCallType) => void;
  toggleParticipants: () => void;
};

type PropsType = IncomingCallBarPropsType &
  CallScreenPropsType &
  CallManagerPropsType;

export const CallManager = ({
  acceptCall,
  availableCameras,
  callDetails,
  callState,
  callEndedReason,
  cancelCall,
  closeNeedPermissionScreen,
  declineCall,
  hangUp,
  hasLocalAudio,
  hasLocalVideo,
  hasRemoteVideo,
  i18n,
  pip,
  renderDeviceSelection,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  setRendererCanvas,
  settingsDialogOpen,
  startCall,
  toggleParticipants,
  togglePip,
  toggleSettings,
}: PropsType): JSX.Element | null => {
  if (!callDetails) {
    return null;
  }
  const incoming = callDetails.isIncoming;
  const outgoing = !incoming;
  const ongoing =
    callState === CallState.Accepted || callState === CallState.Reconnecting;
  const ringing = callState === CallState.Ringing;
  const ended = callState === CallState.Ended;

  if (ended) {
    if (callEndedReason === CallEndedReason.RemoteHangupNeedPermission) {
      return (
        <CallNeedPermissionScreen
          close={closeNeedPermissionScreen}
          callDetails={callDetails}
          i18n={i18n}
        />
      );
    }
    return null;
  }

  if (!callState) {
    return (
      <>
        <CallingLobby
          availableCameras={availableCameras}
          callDetails={callDetails}
          callState={callState}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          isGroupCall={false}
          onCallCanceled={cancelCall}
          onJoinCall={() => {
            startCall({ callDetails });
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

  if (outgoing || ongoing) {
    if (pip) {
      return (
        <CallingPip
          callDetails={callDetails}
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
          callDetails={callDetails}
          callState={callState}
          hangUp={hangUp}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
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

  if (incoming && ringing) {
    return (
      <IncomingCallBar
        acceptCall={acceptCall}
        callDetails={callDetails}
        declineCall={declineCall}
        i18n={i18n}
      />
    );
  }

  // Incoming && Prering
  return null;
};
