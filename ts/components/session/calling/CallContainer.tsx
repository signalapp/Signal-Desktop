import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';

// tslint:disable-next-line: no-submodule-imports
import useMountedState from 'react-use/lib/useMountedState';
import styled from 'styled-components';
import _ from 'underscore';
import { CallManager } from '../../../session/utils';
import {
  getHasOngoingCall,
  getHasOngoingCallWith,
  getSelectedConversationKey,
} from '../../../state/selectors/conversations';
import { SessionButton } from '../SessionButton';

export const DraggableCallWindow = styled.div`
  position: absolute;
  z-index: 9;
  box-shadow: var(--color-session-shadow);
  max-height: 300px;
  width: 300px;
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

const CallWindowControls = styled.div`
  padding: 5px;
  flex-shrink: 0;
`;

const DraggableCallWindowInner = styled.div``;

const VideoContainer = styled.div`
  height: 100%;
  width: 50%;
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

  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);

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

  const handleEndCall = async () => {
    // call method to end call connection
    if (ongoingCallPubkey) {
      await CallManager.USER_rejectIncomingCallRequest(ongoingCallPubkey);
    }
  };

  if (!hasOngoingCall || !ongoingCallProps || ongoingCallPubkey === selectedConversationKey) {
    return null;
  }

  console.warn('rendering with pos', positionX, positionY);

  return (
    <Draggable
      handle=".dragHandle"
      position={{ x: positionX, y: positionY }}
      onStop={(_e: DraggableEvent, data: DraggableData) => {
        console.warn('setting position ', { x: data.x, y: data.y });
        setPositionX(data.x);
        setPositionY(data.y);
      }}
    >
      <DraggableCallWindow className="dragHandle">
        <DraggableCallWindowInner>
          <StyledDraggableVideoElement ref={videoRefRemote} autoPlay={true} />
        </DraggableCallWindowInner>
        <CallWindowControls>
          <SessionButton text={window.i18n('endCall')} onClick={handleEndCall} />
        </CallWindowControls>
      </DraggableCallWindow>
    </Draggable>
  );
};

export const InConvoCallWindow = styled.div`
  padding: 1rem;
  display: flex;
  height: 50%;

  /* background-color: var(--color-background-primary); */

  background: radial-gradient(black, #505050);

  flex-shrink: 0;
  min-height: 200px;
  align-items: center;
`;

export const InConversationCallContainer = () => {
  const ongoingCallProps = useSelector(getHasOngoingCallWith);
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const hasOngoingCall = useSelector(getHasOngoingCall);

  const ongoingCallPubkey = ongoingCallProps?.id;
  const videoRefRemote = useRef<any>();
  const videoRefLocal = useRef<any>();
  const mountedState = useMountedState();

  useEffect(() => {
    if (ongoingCallPubkey === selectedConversationKey) {
      CallManager.setVideoEventsListener(
        (localStream: MediaStream | null, remoteStream: MediaStream | null) => {
          if (mountedState() && videoRefRemote?.current && videoRefLocal?.current) {
            videoRefLocal.current.srcObject = localStream;
            videoRefRemote.current.srcObject = remoteStream;
          }
        }
      );
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

  if (!hasOngoingCall || !ongoingCallProps || ongoingCallPubkey !== selectedConversationKey) {
    return null;
  }

  return (
    <InConvoCallWindow>
      <VideoContainer>
        <StyledVideoElement ref={videoRefRemote} autoPlay={true} />
      </VideoContainer>
      <VideoContainer>
        <StyledVideoElement ref={videoRefLocal} autoPlay={true} />
      </VideoContainer>
    </InConvoCallWindow>
  );
};
