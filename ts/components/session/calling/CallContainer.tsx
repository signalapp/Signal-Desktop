import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { openConversationWithMessages } from '../../../state/ducks/conversations';
import { Avatar, AvatarSize } from '../../Avatar';
import { getConversationController } from '../../../session/conversations';

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

export const StyledVideoElement = styled.video<{ isRemoteVideoMuted: boolean }>`
  padding: 0 1rem;
  height: 100%;
  width: 100%;
  opacity: ${props => (props.isRemoteVideoMuted ? 0 : 1)};
`;

const StyledDraggableVideoElement = styled(StyledVideoElement)`
  padding: 0 0;
`;

const DraggableCallWindowInner = styled.div`
  cursor: pointer;
  min-width: 85px;
  min-height: 85px;
`;

const CenteredAvatarInDraggable = styled.div`
  position: absolute;
  width: 100%;
  top: 0;
  bottom: 0;
  left: 0;
  right: 50%;
  min-height: 85px;
  min-width: 85px;
  display: flex;
  justify-content: center;
  align-items: center;
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
  const [isRemoteVideoMuted, setIsRemoteVideoMuted] = useState(true);

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
        (
          _localStream: MediaStream | null,
          remoteStream: MediaStream | null,
          _camerasList: any,
          _audioList: any,
          remoteVideoIsMuted: boolean
        ) => {
          if (mountedState() && videoRefRemote?.current) {
            videoRefRemote.current.srcObject = remoteStream;
            setIsRemoteVideoMuted(remoteVideoIsMuted);
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
  const ongoingCallUsername = ongoingCallProps?.profileName || ongoingCallProps?.name;

  const avatarPath = ongoingCallPubkey
    ? getConversationController()
        .get(ongoingCallPubkey)
        .getAvatarPath()
    : undefined;

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
          <StyledDraggableVideoElement
            ref={videoRefRemote}
            autoPlay={true}
            isRemoteVideoMuted={isRemoteVideoMuted}
          />
          {isRemoteVideoMuted && (
            <CenteredAvatarInDraggable>
              <Avatar
                size={AvatarSize.XL}
                avatarPath={avatarPath}
                name={ongoingCallUsername}
                pubkey={ongoingCallPubkey}
              />
            </CenteredAvatarInDraggable>
          )}
        </DraggableCallWindowInner>
      </DraggableCallWindow>
    </Draggable>
  );
};
