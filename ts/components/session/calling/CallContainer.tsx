import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';

// tslint:disable-next-line: no-submodule-imports
import useMountedState from 'react-use/lib/useMountedState';
import styled from 'styled-components';
import _ from 'underscore';
import { CallManager, ToastUtils } from '../../../session/utils';
import {
  getHasOngoingCall,
  getHasOngoingCallWith,
  getSelectedConversationKey,
} from '../../../state/selectors/conversations';
import { openConversationWithMessages } from '../../../state/ducks/conversations';
import { SessionIconButton } from '../icon';
import { animation, contextMenu, Item, Menu } from 'react-contexify';
import { InputItem } from '../../../session/utils/CallManager';
import { DropDownAndToggleButton } from '../icon/DropDownAndToggleButton';

export const DraggableCallWindow = styled.div`
  position: absolute;
  z-index: 9;
  box-shadow: var(--color-session-shadow);
  max-height: 300px;
  width: 12vw;
  display: flex;
  flex-direction: column;
  background-color: var(--color-modal-background);
  border: var(--session-border);
`;

const StyledVideoElement = styled.video`
  padding: 0 1rem;
  height: 100%;
  width: 100%;
`;

const StyledDraggableVideoElement = styled(StyledVideoElement)`
  padding: 0 0;
`;

const DraggableCallWindowInner = styled.div`
  cursor: pointer;
`;

const VideoContainer = styled.div`
  height: 100%;
  width: 50%;
`;

export const InConvoCallWindow = styled.div`
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

// TODO:
/**
 * Add mute input, deafen, end call, possibly add person to call
 * duration - look at how duration calculated for recording.
 */
export const DraggableCallContainer = () => {
  const ongoingCallProps = useSelector(getHasOngoingCallWith);
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const hasOngoingCall = useSelector(getHasOngoingCall);

  const [positionX, setPositionX] = useState(window.innerWidth / 2);
  const [positionY, setPositionY] = useState(window.innerHeight / 2);
  const [lastPositionX, setLastPositionX] = useState(0);
  const [lastPositionY, setLastPositionY] = useState(0);

  const ongoingCallPubkey = ongoingCallProps?.id;
  const videoRefRemote = useRef<any>(undefined);
  const mountedState = useMountedState();

  function onWindowResize() {
    if (positionY + 50 > window.innerHeight || positionX + 50 > window.innerWidth) {
      setPositionX(window.innerWidth / 2);
      setPositionY(window.innerHeight / 2);
    }
  }

  useEffect(() => {
    window.addEventListener('resize', onWindowResize);

    return () => {
      window.removeEventListener('resize', onWindowResize);
    };
  }, [positionX, positionY]);

  useEffect(() => {
    if (ongoingCallPubkey !== selectedConversationKey) {
      CallManager.setVideoEventsListener(
        (_localStream: MediaStream | null, remoteStream: MediaStream | null) => {
          if (mountedState() && videoRefRemote?.current) {
            videoRefRemote.current.srcObject = remoteStream;
          }
        }
      );
    }

    return () => {
      CallManager.setVideoEventsListener(null);
    };
  }, [ongoingCallPubkey, selectedConversationKey]);

  const openCallingConversation = useCallback(() => {
    if (ongoingCallPubkey && ongoingCallPubkey !== selectedConversationKey) {
      void openConversationWithMessages({ conversationKey: ongoingCallPubkey });
    }
  }, [ongoingCallPubkey, selectedConversationKey]);

  if (!hasOngoingCall || !ongoingCallProps || ongoingCallPubkey === selectedConversationKey) {
    return null;
  }

  return (
    <Draggable
      handle=".dragHandle"
      position={{ x: positionX, y: positionY }}
      onStart={(_e: DraggableEvent, data: DraggableData) => {
        setLastPositionX(data.x);
        setLastPositionY(data.y);
      }}
      onStop={(e: DraggableEvent, data: DraggableData) => {
        e.stopPropagation();
        if (data.x === lastPositionX && data.y === lastPositionY) {
          // drag did not change anything. Consider this to be a click
          openCallingConversation();
        }
        setPositionX(data.x);
        setPositionY(data.y);
      }}
    >
      <DraggableCallWindow className="dragHandle">
        <DraggableCallWindowInner>
          <StyledDraggableVideoElement ref={videoRefRemote} autoPlay={true} />
        </DraggableCallWindowInner>
      </DraggableCallWindow>
    </Draggable>
  );
};

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
  const videoRefRemote = useRef<any>();
  const videoRefLocal = useRef<any>();
  const mountedState = useMountedState();

  const [isVideoMuted, setVideoMuted] = useState(true);
  const [isAudioMuted, setAudioMuted] = useState(false);

  const videoTriggerId = 'video-menu-trigger-id';
  const audioTriggerId = 'audio-menu-trigger-id';

  useEffect(() => {
    if (ongoingCallPubkey === selectedConversationKey) {
      CallManager.setVideoEventsListener(
        (
          localStream: MediaStream | null,
          remoteStream: MediaStream | null,
          camerasList: Array<InputItem>,
          audioInputList: Array<InputItem>
        ) => {
          if (mountedState() && videoRefRemote?.current && videoRefLocal?.current) {
            videoRefLocal.current.srcObject = localStream;
            videoRefRemote.current.srcObject = remoteStream;
            setCurrentConnectedCameras(camerasList);

            setCurrentConnectedAudioInputs(audioInputList);
          }
        }
      );
    }

    return () => {
      CallManager.setVideoEventsListener(null);
      setCurrentConnectedCameras([]);
      setCurrentConnectedAudioInputs([]);
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
    if (isVideoMuted) {
      // select the first one
      await CallManager.selectCameraByDeviceId(currentConnectedCameras[0].deviceId);
    } else {
      await CallManager.selectCameraByDeviceId(CallManager.INPUT_DISABLED_DEVICE_ID);
    }

    setVideoMuted(!isVideoMuted);
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
          <StyledVideoElement ref={videoRefRemote} autoPlay={true} />
        </VideoContainer>
        <VideoContainer>
          <StyledVideoElement ref={videoRefLocal} autoPlay={true} muted={true} />
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
            isMuted={isVideoMuted}
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
          onUnmute={() => setVideoMuted(false)}
          camerasList={currentConnectedCameras}
        />
        <AudioInputMenu
          triggerId={audioTriggerId}
          onUnmute={() => setAudioMuted(false)}
          audioInputsList={currentConnectedAudioInputs}
        />
      </RelativeCallWindow>
    </InConvoCallWindow>
  );
};
