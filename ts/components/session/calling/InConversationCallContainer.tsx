import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

// tslint:disable-next-line: no-submodule-imports
import useMountedState from 'react-use/lib/useMountedState';
import styled from 'styled-components';
import _ from 'underscore';
import { CallManager, ToastUtils, UserUtils } from '../../../session/utils';
import {
  getHasOngoingCall,
  getHasOngoingCallWith,
  getSelectedConversationKey,
} from '../../../state/selectors/conversations';
import { SessionIconButton } from '../icon';
import { animation, contextMenu, Item, Menu } from 'react-contexify';
import { CallManagerOptionsType, InputItem } from '../../../session/utils/CallManager';
import { DropDownAndToggleButton } from '../icon/DropDownAndToggleButton';
import { StyledVideoElement } from './CallContainer';
import { Avatar, AvatarSize } from '../../Avatar';
import { getConversationController } from '../../../session/conversations';

const VideoContainer = styled.div`
  height: 100%;
  width: 50%;
`;

const InConvoCallWindow = styled.div`
  padding: 1rem;
  display: flex;
  height: 50%;

  background-color: hsl(0, 0%, 15.7%);

  flex-shrink: 0;
  min-height: 200px;
  align-items: center;
`;

const InConvoCallWindowControls = styled.div`
  position: absolute;

  bottom: 0px;
  width: 100%;
  height: 100%;
  align-items: flex-end;
  padding: 10px;
  border-radius: 10px;
  margin-left: auto;
  margin-right: auto;
  left: 0;
  right: 0;
  transition: all 0.25s ease-in-out;

  display: flex;

  justify-content: center;
  opacity: 0;
  &:hover {
    opacity: 1;
  }
`;

const RelativeCallWindow = styled.div`
  position: relative;
  height: 100%;
  display: flex;
  flex-grow: 1;
`;

const VideoInputMenu = ({
  triggerId,
  camerasList,
  onUnmute,
}: {
  triggerId: string;
  onUnmute: () => void;
  camerasList: Array<InputItem>;
}) => {
  return (
    <Menu id={triggerId} animation={animation.fade}>
      {camerasList.map(m => {
        return (
          <Item
            key={m.deviceId}
            onClick={() => {
              onUnmute();
              void CallManager.selectCameraByDeviceId(m.deviceId);
            }}
          >
            {m.label.substr(0, 40)}
          </Item>
        );
      })}
    </Menu>
  );
};

const AudioInputMenu = ({
  triggerId,
  audioInputsList,
  onUnmute,
}: {
  triggerId: string;
  audioInputsList: Array<InputItem>;
  onUnmute: () => void;
}) => {
  return (
    <Menu id={triggerId} animation={animation.fade}>
      {audioInputsList.map(m => {
        return (
          <Item
            key={m.deviceId}
            onClick={() => {
              onUnmute();
              void CallManager.selectAudioInputByDeviceId(m.deviceId);
            }}
          >
            {m.label.substr(0, 40)}
          </Item>
        );
      })}
    </Menu>
  );
};

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

// tslint:disable-next-line: max-func-body-length
export const InConversationCallContainer = () => {
  const ongoingCallProps = useSelector(getHasOngoingCallWith);
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const hasOngoingCall = useSelector(getHasOngoingCall);
  const [currentConnectedCameras, setCurrentConnectedCameras] = useState<Array<InputItem>>([]);
  const [currentConnectedAudioInputs, setCurrentConnectedAudioInputs] = useState<Array<InputItem>>(
    []
  );

  const ongoingCallPubkey = ongoingCallProps?.id;
  const ongoingCallUsername = ongoingCallProps?.profileName || ongoingCallProps?.name;
  const videoRefRemote = useRef<any>();
  const videoRefLocal = useRef<any>();
  const mountedState = useMountedState();

  const [isLocalVideoMuted, setLocalVideoMuted] = useState(true);
  const [isRemoteVideoMuted, setIsRemoteVideoMuted] = useState(true);

  const [isAudioMuted, setAudioMuted] = useState(false);

  const videoTriggerId = 'video-menu-trigger-id';
  const audioTriggerId = 'audio-menu-trigger-id';

  const remoteAvatarPath = ongoingCallPubkey
    ? getConversationController()
        .get(ongoingCallPubkey)
        .getAvatarPath()
    : undefined;

  const ourPubkey = UserUtils.getOurPubKeyStrFromCache();
  const ourUsername = getConversationController()
    .get(ourPubkey)
    .getProfileName();

  const ourAvatarPath = getConversationController()
    .get(ourPubkey)
    .getAvatarPath();

  useEffect(() => {
    if (ongoingCallPubkey === selectedConversationKey) {
      CallManager.setVideoEventsListener((options: CallManagerOptionsType) => {
        const {
          audioInputsList,
          camerasList,
          isLocalVideoStreamMuted,
          isRemoteVideoStreamMuted,
          localStream,
          remoteStream,
        } = options;
        if (mountedState() && videoRefRemote?.current && videoRefLocal?.current) {
          videoRefLocal.current.srcObject = localStream;
          setIsRemoteVideoMuted(isRemoteVideoStreamMuted);
          setLocalVideoMuted(isLocalVideoStreamMuted);
          videoRefRemote.current.srcObject = remoteStream;

          setCurrentConnectedCameras(camerasList);
          setCurrentConnectedAudioInputs(audioInputsList);
        }
      });
    }

    return () => {
      CallManager.setVideoEventsListener(null);
    };
  }, [ongoingCallPubkey, selectedConversationKey]);

  const handleEndCall = async () => {
    // call method to end call connection
    if (ongoingCallPubkey) {
      await CallManager.USER_rejectIncomingCallRequest(ongoingCallPubkey);
    }
  };

  const handleCameraToggle = async () => {
    if (!currentConnectedCameras.length) {
      ToastUtils.pushNoCameraFound();

      return;
    }
    if (isLocalVideoMuted) {
      // select the first one
      await CallManager.selectCameraByDeviceId(currentConnectedCameras[0].deviceId);
    } else {
      await CallManager.selectCameraByDeviceId(CallManager.INPUT_DISABLED_DEVICE_ID);
    }

    setLocalVideoMuted(!isLocalVideoMuted);
  };

  const handleMicrophoneToggle = async () => {
    if (!currentConnectedAudioInputs.length) {
      ToastUtils.pushNoAudioInputFound();

      return;
    }
    if (isAudioMuted) {
      // select the first one
      await CallManager.selectAudioInputByDeviceId(currentConnectedAudioInputs[0].deviceId);
    } else {
      await CallManager.selectAudioInputByDeviceId(CallManager.INPUT_DISABLED_DEVICE_ID);
    }

    setAudioMuted(!isAudioMuted);
  };

  const showAudioInputMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentConnectedAudioInputs.length === 0) {
      ToastUtils.pushNoAudioInputFound();
      return;
    }
    contextMenu.show({
      id: audioTriggerId,
      event: e,
    });
  };

  const showVideoInputMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentConnectedCameras.length === 0) {
      ToastUtils.pushNoCameraFound();
      return;
    }
    contextMenu.show({
      id: videoTriggerId,
      event: e,
    });
  };

  if (!hasOngoingCall || !ongoingCallProps || ongoingCallPubkey !== selectedConversationKey) {
    return null;
  }

  return (
    <InConvoCallWindow>
      <RelativeCallWindow>
        <VideoContainer>
          <StyledVideoElement
            ref={videoRefRemote}
            autoPlay={true}
            isVideoMuted={isRemoteVideoMuted}
          />
          {isRemoteVideoMuted && (
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
            isVideoMuted={isLocalVideoMuted}
          />
          {isLocalVideoMuted && (
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

        <InConvoCallWindowControls>
          <SessionIconButton
            iconSize={60}
            iconPadding="20px"
            iconType="hangup"
            backgroundColor="white"
            borderRadius="50%"
            onClick={handleEndCall}
            iconColor="red"
            margin="10px"
          />
          <DropDownAndToggleButton
            iconType="camera"
            isMuted={isLocalVideoMuted}
            onMainButtonClick={handleCameraToggle}
            onArrowClick={showVideoInputMenu}
          />
          <DropDownAndToggleButton
            iconType="microphone"
            isMuted={isAudioMuted}
            onMainButtonClick={handleMicrophoneToggle}
            onArrowClick={showAudioInputMenu}
          />
        </InConvoCallWindowControls>
        <VideoInputMenu
          triggerId={videoTriggerId}
          onUnmute={() => {
            setLocalVideoMuted(false);
          }}
          camerasList={currentConnectedCameras}
        />
        <AudioInputMenu
          triggerId={audioTriggerId}
          onUnmute={() => {
            setAudioMuted(false);
          }}
          audioInputsList={currentConnectedAudioInputs}
        />
      </RelativeCallWindow>
    </InConvoCallWindow>
  );
};
