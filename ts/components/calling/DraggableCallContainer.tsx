import { useEffect, useRef, useState } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { useSelector } from 'react-redux';

import styled from 'styled-components';
import { useVideoCallEventsListener } from '../../hooks/useVideoEventListener';
import { openConversationWithMessages } from '../../state/ducks/conversations';
import { SectionType } from '../../state/ducks/section';
import { getHasOngoingCall, getHasOngoingCallWith } from '../../state/selectors/call';
import { getSection } from '../../state/selectors/section';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { VideoLoadingSpinner } from './InConversationCallContainer';

export const DraggableCallWindow = styled.div`
  position: absolute;
  z-index: 9;
  box-shadow: var(--modal-drop-shadow);
  max-height: 300px;
  width: 12vw;
  display: flex;
  flex-direction: column;
  background-color: var(--modal-background-content-color);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
`;

export const StyledVideoElement = styled.video<{ isVideoMuted: boolean }>`
  padding: 0 1rem;
  height: 100%;
  width: 100%;
  opacity: ${props => (props.isVideoMuted ? 0 : 1)};
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

export const DraggableCallContainer = () => {
  const ongoingCallProps = useSelector(getHasOngoingCallWith);
  const selectedConversationKey = useSelectedConversationKey();
  const hasOngoingCall = useSelector(getHasOngoingCall);
  const selectedSection = useSelector(getSection);

  // the draggable container has a width of 12vw, so we just set it's X to a bit more than this
  const [positionX, setPositionX] = useState(window.innerWidth - (window.innerWidth * 1) / 6);
  // 90 px is a bit below the conversation header height
  const [positionY, setPositionY] = useState(90);
  const [lastPositionX, setLastPositionX] = useState(0);
  const [lastPositionY, setLastPositionY] = useState(0);

  const ongoingCallPubkey = ongoingCallProps?.id;
  const { remoteStreamVideoIsMuted, remoteStream } = useVideoCallEventsListener(
    'DraggableCallContainer',
    false
  );
  const videoRefRemote = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    function onWindowResize() {
      if (positionY + 50 > window.innerHeight || positionX + 50 > window.innerWidth) {
        setPositionX(window.innerWidth / 2);
        setPositionY(window.innerHeight / 2);
      }
    }
    window.addEventListener('resize', onWindowResize);

    return () => {
      window.removeEventListener('resize', onWindowResize);
    };
  }, [positionX, positionY]);

  if (videoRefRemote?.current && remoteStream) {
    if (videoRefRemote.current.srcObject !== remoteStream) {
      videoRefRemote.current.srcObject = remoteStream;
    }
  }

  const openCallingConversation = () => {
    if (ongoingCallPubkey && ongoingCallPubkey !== selectedConversationKey) {
      void openConversationWithMessages({ conversationKey: ongoingCallPubkey, messageId: null });
    }
  };

  if (
    !hasOngoingCall ||
    !ongoingCallProps ||
    (ongoingCallPubkey === selectedConversationKey &&
      selectedSection.focusedSection !== SectionType.Settings)
  ) {
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
          <VideoLoadingSpinner fullWidth={true} />
          <StyledDraggableVideoElement
            ref={videoRefRemote}
            autoPlay={true}
            isVideoMuted={remoteStreamVideoIsMuted}
          />
          {remoteStreamVideoIsMuted && ongoingCallPubkey && (
            <CenteredAvatarInDraggable>
              <Avatar size={AvatarSize.XL} pubkey={ongoingCallPubkey} />
            </CenteredAvatarInDraggable>
          )}
        </DraggableCallWindowInner>
      </DraggableCallWindow>
    </Draggable>
  );
};
