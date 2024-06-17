import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { useVideoCallEventsListener } from '../../hooks/useVideoEventListener';
import { setFullScreenCall } from '../../state/ducks/call';
import {
  getCallIsInFullScreen,
  getHasOngoingCallWithFocusedConvo,
} from '../../state/selectors/call';
import { CallWindowControls } from './CallButtons';
import { StyledVideoElement } from './DraggableCallContainer';

const CallInFullScreenVisible = styled.div`
  position: absolute;
  z-index: 9;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--black-color);
  border: 1px solid var(--border-color);
  opacity: 1;
`;

const StyledLocalVideoElement = styled.video<{ isVideoMuted: boolean }>`
  height: 20%;
  width: 20%;
  bottom: 0;
  right: 0;
  position: absolute;
  opacity: ${props => (props.isVideoMuted ? 0 : 1)};
`;

export const CallInFullScreenContainer = () => {
  const dispatch = useDispatch();
  const ongoingCallWithFocused = useSelector(getHasOngoingCallWithFocusedConvo);
  const hasOngoingCallFullScreen = useSelector(getCallIsInFullScreen);

  const {
    remoteStream,
    remoteStreamVideoIsMuted,
    localStream,
    currentConnectedAudioInputs,
    currentConnectedAudioOutputs,
    currentConnectedCameras,
    isAudioMuted,
    isAudioOutputMuted,
    localStreamVideoIsMuted,
  } = useVideoCallEventsListener('CallInFullScreenContainer', true);

  const videoRefRemote = useRef<HTMLVideoElement>(null);
  const videoRefLocal = useRef<HTMLVideoElement>(null);

  function toggleFullScreenOFF() {
    dispatch(setFullScreenCall(false));
  }

  useKey('Escape', () => {
    toggleFullScreenOFF();
  });

  useEffect(() => {
    // close fullscreen mode if the remote video gets muted
    if (remoteStreamVideoIsMuted) {
      dispatch(setFullScreenCall(false));
    }
  }, [remoteStreamVideoIsMuted, dispatch]);

  if (!ongoingCallWithFocused || !hasOngoingCallFullScreen) {
    return null;
  }

  if (videoRefRemote?.current) {
    if (videoRefRemote.current.srcObject !== remoteStream) {
      videoRefRemote.current.srcObject = remoteStream;
    }
  }

  if (videoRefLocal?.current) {
    if (videoRefLocal.current.srcObject !== localStream) {
      videoRefLocal.current.srcObject = localStream;
    }
  }

  return (
    <CallInFullScreenVisible onClick={toggleFullScreenOFF}>
      <StyledVideoElement
        ref={videoRefRemote}
        autoPlay={true}
        isVideoMuted={remoteStreamVideoIsMuted}
      />
      <StyledLocalVideoElement
        ref={videoRefLocal}
        autoPlay={true}
        isVideoMuted={localStreamVideoIsMuted}
      />
      <CallWindowControls
        currentConnectedAudioInputs={currentConnectedAudioInputs}
        currentConnectedAudioOutputs={currentConnectedAudioOutputs}
        currentConnectedCameras={currentConnectedCameras}
        isAudioMuted={isAudioMuted}
        isAudioOutputMuted={isAudioOutputMuted}
        localStreamVideoIsMuted={localStreamVideoIsMuted}
        remoteStreamVideoIsMuted={remoteStreamVideoIsMuted}
        isFullScreen={true}
      />
    </CallInFullScreenVisible>
  );
};
