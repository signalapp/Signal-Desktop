import React, { useRef } from 'react';
import { useSelector } from 'react-redux';

import styled from 'styled-components';
import _ from 'underscore';
import { UserUtils } from '../../../session/utils';
import {
  getHasOngoingCallWith,
  getHasOngoingCallWithFocusedConvo,
  getHasOngoingCallWithFocusedConvoIsOffering,
  getHasOngoingCallWithFocusedConvosIsConnecting,
  getHasOngoingCallWithPubkey,
} from '../../../state/selectors/conversations';
import { StyledVideoElement } from './DraggableCallContainer';
import { Avatar, AvatarSize } from '../../Avatar';

import { useVideoCallEventsListener } from '../../../hooks/useVideoEventListener';
import {
  useAvatarPath,
  useOurAvatarPath,
  useOurConversationUsername,
} from '../../../hooks/useParamSelector';
import { useModuloWithTripleDots } from '../../../hooks/useModuloWithTripleDots';
import { CallWindowControls } from './CallButtons';
import { SessionSpinner } from '../SessionSpinner';
import { DEVICE_DISABLED_DEVICE_ID } from '../../../session/utils/CallManager';
// import { useCallAudioLevel } from '../../../hooks/useCallAudioLevel';

const VideoContainer = styled.div`
  height: 100%;
  width: 50%;
  z-index: 0;
`;

const InConvoCallWindow = styled.div`
  padding: 1rem;
  display: flex;

  background-color: hsl(0, 0%, 15.7%);

  flex-shrink: 1;
  min-height: 80px;
  align-items: center;
  flex-grow: 1;
`;

const RelativeCallWindow = styled.div`
  position: relative;
  height: 100%;
  display: flex;
  flex-grow: 1;
`;

const CenteredAvatarInConversation = styled.div`
  top: -50%;
  transform: translateY(-50%);
  position: relative;
  bottom: 0;
  left: 0;
  right: 50%;

  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledCenteredLabel = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  height: min-content;
  white-space: nowrap;
  color: white;
  text-shadow: 0px 0px 8px white;
`;

const RingingLabel = () => {
  const ongoingCallWithFocusedIsRinging = useSelector(getHasOngoingCallWithFocusedConvoIsOffering);

  const modulatedStr = useModuloWithTripleDots(window.i18n('ringing'), 3, 1000);
  if (!ongoingCallWithFocusedIsRinging) {
    return null;
  }
  return <StyledCenteredLabel>{modulatedStr}</StyledCenteredLabel>;
};

const ConnectingLabel = () => {
  const ongoingCallWithFocusedIsConnecting = useSelector(
    getHasOngoingCallWithFocusedConvosIsConnecting
  );

  const modulatedStr = useModuloWithTripleDots(window.i18n('establishingConnection'), 3, 1000);

  if (!ongoingCallWithFocusedIsConnecting) {
    return null;
  }

  return <StyledCenteredLabel>{modulatedStr}</StyledCenteredLabel>;
};

const StyledSpinner = styled.div<{ fullWidth: boolean }>`
  height: 100%;
  width: ${props => (props.fullWidth ? '100%' : '50%')};
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  z-index: -1;
`;

export const VideoLoadingSpinner = (props: { fullWidth: boolean }) => {
  return (
    <StyledSpinner fullWidth={props.fullWidth}>
      <SessionSpinner loading={true} />
    </StyledSpinner>
  );
};

// tslint:disable-next-line: max-func-body-length
export const InConversationCallContainer = () => {
  const ongoingCallProps = useSelector(getHasOngoingCallWith);

  const ongoingCallPubkey = useSelector(getHasOngoingCallWithPubkey);
  const ongoingCallWithFocused = useSelector(getHasOngoingCallWithFocusedConvo);
  const ongoingCallUsername = ongoingCallProps?.profileName || ongoingCallProps?.name;
  const videoRefRemote = useRef<HTMLVideoElement>(null);
  const videoRefLocal = useRef<HTMLVideoElement>(null);

  const ourPubkey = UserUtils.getOurPubKeyStrFromCache();

  const remoteAvatarPath = useAvatarPath(ongoingCallPubkey);
  const ourAvatarPath = useOurAvatarPath();

  const ourUsername = useOurConversationUsername();

  const {
    currentConnectedAudioInputs,
    currentConnectedCameras,
    currentConnectedAudioOutputs,
    currentSelectedAudioOutput,
    localStream,
    localStreamVideoIsMuted,
    remoteStream,
    remoteStreamVideoIsMuted,
    isAudioMuted,
    isAudioOutputMuted,
  } = useVideoCallEventsListener('InConversationCallContainer', true);

  // const isSpeaking = useCallAudioLevel();

  if (videoRefRemote?.current && videoRefLocal?.current) {
    if (videoRefRemote.current.srcObject !== remoteStream) {
      videoRefRemote.current.srcObject = remoteStream;
    }

    if (videoRefLocal.current.srcObject !== localStream) {
      videoRefLocal.current.srcObject = localStream;
    }

    if (videoRefRemote.current) {
      if (currentSelectedAudioOutput === DEVICE_DISABLED_DEVICE_ID) {
        videoRefLocal.current.muted = true;
      } else {
        // void videoRefLocal.current.setSinkId(currentSelectedAudioOutput);
        videoRefLocal.current.muted = false;
      }
    }
  }

  if (!ongoingCallWithFocused) {
    return null;
  }

  return (
    <InConvoCallWindow>
      <RelativeCallWindow>
        <RingingLabel />
        <ConnectingLabel />
        <VideoContainer>
          <VideoLoadingSpinner fullWidth={false} />
          <StyledVideoElement
            ref={videoRefRemote}
            autoPlay={true}
            isVideoMuted={remoteStreamVideoIsMuted}
          />
          {remoteStreamVideoIsMuted && (
            <CenteredAvatarInConversation>
              <Avatar
                size={AvatarSize.XL}
                avatarPath={remoteAvatarPath}
                name={ongoingCallUsername}
                pubkey={ongoingCallPubkey}
              />
            </CenteredAvatarInConversation>
          )}
        </VideoContainer>
        <VideoContainer>
          <StyledVideoElement
            ref={videoRefLocal}
            autoPlay={true}
            muted={true}
            isVideoMuted={localStreamVideoIsMuted}
          />
          {localStreamVideoIsMuted && (
            <CenteredAvatarInConversation>
              <Avatar
                size={AvatarSize.XL}
                avatarPath={ourAvatarPath}
                name={ourUsername}
                pubkey={ourPubkey}
              />
            </CenteredAvatarInConversation>
          )}
        </VideoContainer>

        <CallWindowControls
          currentConnectedAudioInputs={currentConnectedAudioInputs}
          currentConnectedCameras={currentConnectedCameras}
          isAudioMuted={isAudioMuted}
          currentConnectedAudioOutputs={currentConnectedAudioOutputs}
          isAudioOutputMuted={isAudioOutputMuted}
          localStreamVideoIsMuted={localStreamVideoIsMuted}
          remoteStreamVideoIsMuted={remoteStreamVideoIsMuted}
          isFullScreen={false}
        />
      </RelativeCallWindow>
    </InConvoCallWindow>
  );
};
