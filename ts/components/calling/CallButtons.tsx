import { SessionIconButton } from '../icon';
import { animation, contextMenu, Item, Menu } from 'react-contexify';
import { InputItem } from '../../session/utils/calling/CallManager';
import { setFullScreenCall } from '../../state/ducks/call';
import { CallManager, ToastUtils } from '../../session/utils';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getHasOngoingCallWithPubkey } from '../../state/selectors/call';
import { DropDownAndToggleButton } from '../icon/DropDownAndToggleButton';
import styled from 'styled-components';

const videoTriggerId = 'video-menu-trigger-id';
const audioTriggerId = 'audio-menu-trigger-id';
const audioOutputTriggerId = 'audio-output-menu-trigger-id';

export const VideoInputButton = ({
  currentConnectedCameras,
  localStreamVideoIsMuted,
  hideArrowIcon = false,
}: {
  currentConnectedCameras: Array<InputItem>;
  localStreamVideoIsMuted: boolean;
  hideArrowIcon?: boolean;
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
        hidePopoverArrow={hideArrowIcon}
      />

      <VideoInputMenu triggerId={videoTriggerId} camerasList={currentConnectedCameras} />
    </>
  );
};

export const AudioInputButton = ({
  currentConnectedAudioInputs,
  isAudioMuted,
  hideArrowIcon = false,
}: {
  currentConnectedAudioInputs: Array<InputItem>;
  isAudioMuted: boolean;
  hideArrowIcon?: boolean;
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
        hidePopoverArrow={hideArrowIcon}
      />

      <AudioInputMenu triggerId={audioTriggerId} audioInputsList={currentConnectedAudioInputs} />
    </>
  );
};

export const AudioOutputButton = ({
  currentConnectedAudioOutputs,
  isAudioOutputMuted,
  hideArrowIcon = false,
}: {
  currentConnectedAudioOutputs: Array<InputItem>;
  isAudioOutputMuted: boolean;
  hideArrowIcon?: boolean;
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
        hidePopoverArrow={hideArrowIcon}
      />

      <AudioOutputMenu
        triggerId={audioOutputTriggerId}
        audioOutputsList={currentConnectedAudioOutputs}
      />
    </>
  );
};

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

const AudioOutputMenu = ({
  triggerId,
  audioOutputsList,
}: {
  triggerId: string;
  audioOutputsList: Array<InputItem>;
}) => {
  return (
    <Menu id={triggerId} animation={animation.fade}>
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
  );
};

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

export const HangUpButton = () => {
  const ongoingCallPubkey = useSelector(getHasOngoingCallWithPubkey);

  const handleEndCall = async () => {
    // call method to end call connection
    if (ongoingCallPubkey) {
      await CallManager.USER_hangup(ongoingCallPubkey);
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
    ToastUtils.pushNoAudioInputFound();

    return;
  }
  if (isAudioOutputMuted) {
    // selects the first one
    await CallManager.selectAudioOutputByDeviceId(currentConnectedAudioOutputs[0].deviceId);
  } else {
    await CallManager.selectAudioOutputByDeviceId(CallManager.DEVICE_DISABLED_DEVICE_ID);
  }
};

const StyledCallWindowControls = styled.div<{ makeVisible: boolean }>`
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
  opacity: ${props => (props.makeVisible ? 1 : 0)};
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
    <StyledCallWindowControls makeVisible={makeVisible}>
      {!remoteStreamVideoIsMuted && <ShowInFullScreenButton isFullScreen={isFullScreen} />}

      <VideoInputButton
        currentConnectedCameras={currentConnectedCameras}
        localStreamVideoIsMuted={localStreamVideoIsMuted}
        hideArrowIcon={isFullScreen}
      />
      <AudioInputButton
        currentConnectedAudioInputs={currentConnectedAudioInputs}
        isAudioMuted={isAudioMuted}
        hideArrowIcon={isFullScreen}
      />
      <AudioOutputButton
        currentConnectedAudioOutputs={currentConnectedAudioOutputs}
        isAudioOutputMuted={isAudioOutputMuted}
        hideArrowIcon={isFullScreen}
      />
      <HangUpButton />
    </StyledCallWindowControls>
  );
};
