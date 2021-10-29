import React, { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import styled from 'styled-components';
import _ from 'underscore';
import { CallManager, ToastUtils, UserUtils } from '../../../session/utils';
import {
  getHasOngoingCall,
  getHasOngoingCallWith,
  getHasOngoingCallWithPubkey,
  getSelectedConversationKey,
} from '../../../state/selectors/conversations';
import { SessionIconButton } from '../icon';
import { animation, contextMenu, Item, Menu } from 'react-contexify';
import { InputItem } from '../../../session/utils/CallManager';
import { DropDownAndToggleButton } from '../icon/DropDownAndToggleButton';
import { StyledVideoElement } from './DraggableCallContainer';
import { Avatar, AvatarSize } from '../../Avatar';
import { setFullScreenCall } from '../../../state/ducks/conversations';
import { useVideoCallEventsListener } from '../../../hooks/useVideoEventListener';
import {
  useAvatarPath,
  useOurAvatarPath,
  useOurConversationUsername,
} from '../../../hooks/useParamSelector';

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
}: {
  triggerId: string;
  camerasList: Array<InputItem>;
}) => {
  return (
    <Menu id={triggerId} animation={animation.fade}>
      {camerasList.map(m => {
        return (
          <Item
            key={m.deviceId}
            onClick={() => {
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
}: {
  triggerId: string;
  audioInputsList: Array<InputItem>;
}) => {
  return (
    <Menu id={triggerId} animation={animation.fade}>
      {audioInputsList.map(m => {
        return (
          <Item
            key={m.deviceId}
            onClick={() => {
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

const videoTriggerId = 'video-menu-trigger-id';
const audioTriggerId = 'audio-menu-trigger-id';

const ShowInFullScreenButton = () => {
  const dispatch = useDispatch();

  const showInFullScreen = () => {
    dispatch(setFullScreenCall(true));
  };

  return (
    <SessionIconButton
      iconSize={60}
      iconPadding="20px"
      iconType="fullscreen"
      backgroundColor="white"
      borderRadius="50%"
      onClick={showInFullScreen}
      iconColor="black"
      margin="10px"
    />
  );
};

const HangUpButton = () => {
  const ongoingCallPubkey = useSelector(getHasOngoingCallWithPubkey);

  const handleEndCall = async () => {
    // call method to end call connection
    if (ongoingCallPubkey) {
      await CallManager.USER_rejectIncomingCallRequest(ongoingCallPubkey);
    }
  };

  return (
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
  );
};

const showAudioInputMenu = (
  currentConnectedAudioInputs: Array<any>,
  e: React.MouseEvent<HTMLDivElement>
) => {
  if (currentConnectedAudioInputs.length === 0) {
    ToastUtils.pushNoAudioInputFound();
    return;
  }
  contextMenu.show({
    id: audioTriggerId,
    event: e,
  });
};

const showVideoInputMenu = (
  currentConnectedCameras: Array<any>,
  e: React.MouseEvent<HTMLDivElement>
) => {
  if (currentConnectedCameras.length === 0) {
    ToastUtils.pushNoCameraFound();
    return;
  }
  contextMenu.show({
    id: videoTriggerId,
    event: e,
  });
};

const handleCameraToggle = async (
  currentConnectedCameras: Array<InputItem>,
  localStreamVideoIsMuted: boolean
) => {
  if (!currentConnectedCameras.length) {
    ToastUtils.pushNoCameraFound();

    return;
  }
  if (localStreamVideoIsMuted) {
    // select the first one
    await CallManager.selectCameraByDeviceId(currentConnectedCameras[0].deviceId);
  } else {
    await CallManager.selectCameraByDeviceId(CallManager.INPUT_DISABLED_DEVICE_ID);
  }
};

const handleMicrophoneToggle = async (
  currentConnectedAudioInputs: Array<InputItem>,
  isAudioMuted: boolean
) => {
  if (!currentConnectedAudioInputs.length) {
    ToastUtils.pushNoAudioInputFound();

    return;
  }
  if (isAudioMuted) {
    // selects the first one
    await CallManager.selectAudioInputByDeviceId(currentConnectedAudioInputs[0].deviceId);
  } else {
    await CallManager.selectAudioInputByDeviceId(CallManager.INPUT_DISABLED_DEVICE_ID);
  }
};

// tslint:disable-next-line: max-func-body-length
export const InConversationCallContainer = () => {
  const ongoingCallProps = useSelector(getHasOngoingCallWith);
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const hasOngoingCall = useSelector(getHasOngoingCall);

  const ongoingCallPubkey = useSelector(getHasOngoingCallWithPubkey);
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
    localStream,
    localStreamVideoIsMuted,
    remoteStream,
    remoteStreamVideoIsMuted,
    isAudioMuted,
  } = useVideoCallEventsListener('InConversationCallContainer', true);

  if (videoRefRemote?.current && videoRefLocal?.current) {
    videoRefRemote.current.srcObject = remoteStream;
    videoRefLocal.current.srcObject = localStream;
  }

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

        <InConvoCallWindowControls>
          <HangUpButton />
          <DropDownAndToggleButton
            iconType="camera"
            isMuted={localStreamVideoIsMuted}
            onMainButtonClick={() => {
              void handleCameraToggle(currentConnectedCameras, localStreamVideoIsMuted);
            }}
            onArrowClick={e => {
              showVideoInputMenu(currentConnectedCameras, e);
            }}
          />
          <DropDownAndToggleButton
            iconType="microphone"
            isMuted={isAudioMuted}
            onMainButtonClick={() => {
              void handleMicrophoneToggle(currentConnectedAudioInputs, isAudioMuted);
            }}
            onArrowClick={e => {
              showAudioInputMenu(currentConnectedAudioInputs, e);
            }}
          />
          <ShowInFullScreenButton />
        </InConvoCallWindowControls>
        <VideoInputMenu triggerId={videoTriggerId} camerasList={currentConnectedCameras} />
        <AudioInputMenu triggerId={audioTriggerId} audioInputsList={currentConnectedAudioInputs} />
      </RelativeCallWindow>
    </InConvoCallWindow>
  );
};
