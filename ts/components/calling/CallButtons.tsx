import React, { useEffect, useState } from 'react';
import { contextMenu, Item, Menu } from 'react-contexify';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { CallManager, ToastUtils } from '../../session/utils';
import { InputItem } from '../../session/utils/calling/CallManager';
import { setFullScreenCall } from '../../state/ducks/call';
import { getHasOngoingCallWithPubkey } from '../../state/selectors/call';
import { SessionIconButton } from '../icon';
import { DropDownAndToggleButton } from '../icon/DropDownAndToggleButton';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

const VideoInputMenu = ({
  triggerId,
  camerasList,
}: {
  triggerId: string;
  camerasList: Array<InputItem>;
}) => {
  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation="fade">
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
    </SessionContextMenuContainer>
  );
};

const showVideoInputMenu = (
  currentConnectedCameras: Array<InputItem>,
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

const videoTriggerId = 'video-menu-trigger-id';
const audioTriggerId = 'audio-menu-trigger-id';
const audioOutputTriggerId = 'audio-output-menu-trigger-id';

export const VideoInputButton = ({
  currentConnectedCameras,
  localStreamVideoIsMuted,
  isFullScreen = false,
}: {
  currentConnectedCameras: Array<InputItem>;
  localStreamVideoIsMuted: boolean;
  isFullScreen?: boolean;
}) => {
  return (
    <>
      <DropDownAndToggleButton
        iconType="camera"
        isMuted={localStreamVideoIsMuted}
        onMainButtonClick={() => {
          void handleCameraToggle(currentConnectedCameras, localStreamVideoIsMuted);
        }}
        onArrowClick={e => {
          showVideoInputMenu(currentConnectedCameras, e);
        }}
        isFullScreen={isFullScreen}
      />

      <VideoInputMenu triggerId={videoTriggerId} camerasList={currentConnectedCameras} />
    </>
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
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation="fade">
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
    </SessionContextMenuContainer>
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

export const AudioInputButton = ({
  currentConnectedAudioInputs,
  isAudioMuted,
  isFullScreen = false,
}: {
  currentConnectedAudioInputs: Array<InputItem>;
  isAudioMuted: boolean;
  isFullScreen?: boolean;
}) => {
  return (
    <>
      <DropDownAndToggleButton
        iconType="microphone"
        isMuted={isAudioMuted}
        onMainButtonClick={() => {
          void handleMicrophoneToggle(currentConnectedAudioInputs, isAudioMuted);
        }}
        onArrowClick={e => {
          showAudioInputMenu(currentConnectedAudioInputs, e);
        }}
        isFullScreen={isFullScreen}
      />

      <AudioInputMenu triggerId={audioTriggerId} audioInputsList={currentConnectedAudioInputs} />
    </>
  );
};

const AudioOutputMenu = ({
  triggerId,
  audioOutputsList,
}: {
  triggerId: string;
  audioOutputsList: Array<InputItem>;
}) => {
  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation="fade">
        {audioOutputsList.map(m => {
          return (
            <Item
              key={m.deviceId}
              onClick={() => {
                void CallManager.selectAudioOutputByDeviceId(m.deviceId);
              }}
            >
              {m.label.substr(0, 40)}
            </Item>
          );
        })}
      </Menu>
    </SessionContextMenuContainer>
  );
};

const showAudioOutputMenu = (
  currentConnectedAudioOutputs: Array<any>,
  e: React.MouseEvent<HTMLDivElement>
) => {
  if (currentConnectedAudioOutputs.length === 0) {
    ToastUtils.pushNoAudioOutputFound();
    return;
  }
  contextMenu.show({
    id: audioOutputTriggerId,
    event: e,
  });
};

export const AudioOutputButton = ({
  currentConnectedAudioOutputs,
  isAudioOutputMuted,
  isFullScreen = false,
}: {
  currentConnectedAudioOutputs: Array<InputItem>;
  isAudioOutputMuted: boolean;
  isFullScreen?: boolean;
}) => {
  return (
    <>
      <DropDownAndToggleButton
        iconType="volume"
        isMuted={isAudioOutputMuted}
        onMainButtonClick={() => {
          void handleSpeakerToggle(currentConnectedAudioOutputs, isAudioOutputMuted);
        }}
        onArrowClick={e => {
          showAudioOutputMenu(currentConnectedAudioOutputs, e);
        }}
        isFullScreen={isFullScreen}
      />

      <AudioOutputMenu
        triggerId={audioOutputTriggerId}
        audioOutputsList={currentConnectedAudioOutputs}
      />
    </>
  );
};

const StyledCallActionButton = styled.div<{ isFullScreen: boolean }>`
  .session-icon-button {
    background-color: var(--call-buttons-action-background-color);
    border-radius: 50%;
    transition-duration: var(--default-duration);
    ${props => props.isFullScreen && 'opacity: 0.4;'}
    &:hover {
      background-color: var(--call-buttons-action-background-hover-color);
      ${props => props.isFullScreen && 'opacity: 1;'}
    }
  }
`;

const ShowInFullScreenButton = ({ isFullScreen }: { isFullScreen: boolean }) => {
  const dispatch = useDispatch();

  const showInFullScreen = () => {
    if (isFullScreen) {
      dispatch(setFullScreenCall(false));
    } else {
      dispatch(setFullScreenCall(true));
    }
  };

  return (
    <StyledCallActionButton isFullScreen={isFullScreen}>
      <SessionIconButton
        iconSize={60}
        iconPadding="20px"
        iconType="fullscreen"
        borderRadius="50%"
        onClick={showInFullScreen}
        iconColor="var(--call-buttons-action-icon-color)"
        margin="10px"
      />
    </StyledCallActionButton>
  );
};

export const HangUpButton = ({ isFullScreen }: { isFullScreen: boolean }) => {
  const ongoingCallPubkey = useSelector(getHasOngoingCallWithPubkey);

  const handleEndCall = async () => {
    // call method to end call connection
    if (ongoingCallPubkey) {
      await CallManager.USER_hangup(ongoingCallPubkey);
    }
  };

  return (
    <StyledCallActionButton isFullScreen={isFullScreen}>
      <SessionIconButton
        iconSize={60}
        iconPadding="20px"
        iconType="hangup"
        iconColor="var(--danger-color)"
        borderRadius="50%"
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={handleEndCall}
        margin="10px"
        dataTestId="end-call"
      />
    </StyledCallActionButton>
  );
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
    await CallManager.selectCameraByDeviceId(CallManager.DEVICE_DISABLED_DEVICE_ID);
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
    await CallManager.selectAudioInputByDeviceId(CallManager.DEVICE_DISABLED_DEVICE_ID);
  }
};

const handleSpeakerToggle = async (
  currentConnectedAudioOutputs: Array<InputItem>,
  isAudioOutputMuted: boolean
) => {
  if (!currentConnectedAudioOutputs.length) {
    ToastUtils.pushNoAudioOutputFound();

    return;
  }
  if (isAudioOutputMuted) {
    // selects the first one
    await CallManager.selectAudioOutputByDeviceId(currentConnectedAudioOutputs[0].deviceId);
  } else {
    await CallManager.selectAudioOutputByDeviceId(CallManager.DEVICE_DISABLED_DEVICE_ID);
  }
};

const StyledCallWindowControls = styled.div<{ isFullScreen: boolean; makeVisible: boolean }>`
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
  transition: all var(--default-duration) ease-in-out;

  display: flex;
  justify-content: center;
  opacity: ${props => (props.makeVisible ? 1 : 0)};

  ${props =>
    props.isFullScreen &&
    `
    opacity: 0.4;
    &:hover {
      opacity: 1;
    }
  `}
`;

export const CallWindowControls = ({
  currentConnectedCameras,
  currentConnectedAudioInputs,
  currentConnectedAudioOutputs,
  isAudioMuted,
  isAudioOutputMuted,
  remoteStreamVideoIsMuted,
  localStreamVideoIsMuted,
  isFullScreen,
}: {
  isAudioMuted: boolean;
  isAudioOutputMuted: boolean;
  localStreamVideoIsMuted: boolean;
  remoteStreamVideoIsMuted: boolean;
  currentConnectedAudioInputs: Array<InputItem>;
  currentConnectedAudioOutputs: Array<InputItem>;
  currentConnectedCameras: Array<InputItem>;
  isFullScreen: boolean;
}) => {
  const [makeVisible, setMakeVisible] = useState(true);

  const setMakeVisibleTrue = () => {
    setMakeVisible(true);
  };
  const setMakeVisibleFalse = () => {
    setMakeVisible(false);
  };

  useEffect(() => {
    setMakeVisibleTrue();
    document.addEventListener('mouseenter', setMakeVisibleTrue);
    document.addEventListener('mouseleave', setMakeVisibleFalse);

    return () => {
      document.removeEventListener('mouseenter', setMakeVisibleTrue);
      document.removeEventListener('mouseleave', setMakeVisibleFalse);
    };
  }, [isFullScreen]);
  return (
    <StyledCallWindowControls isFullScreen={isFullScreen} makeVisible={makeVisible}>
      {!remoteStreamVideoIsMuted && <ShowInFullScreenButton isFullScreen={isFullScreen} />}

      <VideoInputButton
        currentConnectedCameras={currentConnectedCameras}
        localStreamVideoIsMuted={localStreamVideoIsMuted}
        isFullScreen={isFullScreen}
      />
      <AudioInputButton
        currentConnectedAudioInputs={currentConnectedAudioInputs}
        isAudioMuted={isAudioMuted}
        isFullScreen={isFullScreen}
      />
      <AudioOutputButton
        currentConnectedAudioOutputs={currentConnectedAudioOutputs}
        isAudioOutputMuted={isAudioOutputMuted}
        isFullScreen={isFullScreen}
      />
      <HangUpButton isFullScreen={isFullScreen} />
    </StyledCallWindowControls>
  );
};
