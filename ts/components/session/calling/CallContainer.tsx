import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Draggable from 'react-draggable';

// tslint:disable-next-line: no-submodule-imports
import useMountedState from 'react-use/lib/useMountedState';
import styled from 'styled-components';
import _ from 'underscore';
import { CallManager } from '../../../session/utils';
import {
  getHasIncomingCall,
  getHasIncomingCallFrom,
  getHasOngoingCall,
  getHasOngoingCallWith,
} from '../../../state/selectors/conversations';
import { SessionButton, SessionButtonColor } from '../SessionButton';
import { SessionWrapperModal } from '../SessionWrapperModal';

export const CallWindow = styled.div`
  position: absolute;
  z-index: 9;
  padding: 1rem;
  top: 50vh;
  left: 50vw;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  background-color: var(--color-modal-background);
  border: var(--session-border);
`;

// similar styling to modal header
const CallWindowHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-self: center;

  padding: $session-margin-lg;

  font-family: $session-font-default;
  text-align: center;
  line-height: 18px;
  font-size: $session-font-md;
  font-weight: 700;
`;

const VideoContainer = styled.div`
  position: relative;
  max-height: 60vh;
`;

const VideoContainerRemote = styled.video`
  max-height: inherit;
`;
const VideoContainerLocal = styled.video`
  max-height: 45%;
  max-width: 45%;
  position: absolute;
  bottom: 0;
  right: 0;
`;

const CallWindowInner = styled.div`
  text-align: center;
  padding: 1rem;
`;

const CallWindowControls = styled.div`
  padding: 5px;
`;

// TODO:
/**
 * Add mute input, deafen, end call, possibly add person to call
 * duration - look at how duration calculated for recording.
 */
export const CallContainer = () => {
  const hasIncomingCall = useSelector(getHasIncomingCall);
  const incomingCallProps = useSelector(getHasIncomingCallFrom);
  const ongoingCallProps = useSelector(getHasOngoingCallWith);
  const hasOngoingCall = useSelector(getHasOngoingCall);

  const ongoingOrIncomingPubkey = ongoingCallProps?.id || incomingCallProps?.id;
  const videoRefRemote = useRef<any>();
  const videoRefLocal = useRef<any>();
  const mountedState = useMountedState();

  useEffect(() => {
    CallManager.setVideoEventsListener(
      (localStream: MediaStream | null, remoteStream: MediaStream | null) => {
        if (mountedState() && videoRefRemote?.current && videoRefLocal?.current) {
          videoRefLocal.current.srcObject = localStream;
          videoRefRemote.current.srcObject = remoteStream;
        }
      }
    );

    return () => {
      CallManager.setVideoEventsListener(null);
    };
  }, []);

  //#region input handlers
  const handleAcceptIncomingCall = async () => {
    if (incomingCallProps?.id) {
      await CallManager.USER_acceptIncomingCallRequest(incomingCallProps.id);
    }
  };

  const handleDeclineIncomingCall = async () => {
    // close the modal
    if (incomingCallProps?.id) {
      await CallManager.USER_rejectIncomingCallRequest(incomingCallProps.id);
    }
  };

  const handleEndCall = async () => {
    // call method to end call connection
    if (ongoingOrIncomingPubkey) {
      await CallManager.USER_rejectIncomingCallRequest(ongoingOrIncomingPubkey);
    }
  };

  //#endregion

  if (!hasOngoingCall && !hasIncomingCall) {
    return null;
  }

  if (hasOngoingCall && ongoingCallProps) {
    return (
      <Draggable handle=".dragHandle">
        <CallWindow className="dragHandle">
          <CallWindowHeader>Call with: {ongoingCallProps.name}</CallWindowHeader>

          <CallWindowInner>
            <div>{hasIncomingCall}</div>
            <VideoContainer>
              <VideoContainerRemote ref={videoRefRemote} autoPlay={true} />
              <VideoContainerLocal ref={videoRefLocal} autoPlay={true} />
            </VideoContainer>
          </CallWindowInner>
          <CallWindowControls>
            <SessionButton text={window.i18n('endCall')} onClick={handleEndCall} />
          </CallWindowControls>
        </CallWindow>
      </Draggable>
    );
  }

  if (hasIncomingCall) {
    return (
      <SessionWrapperModal title={window.i18n('incomingCall')}>
        <div className="session-modal__button-group">
          <SessionButton text={window.i18n('decline')} onClick={handleDeclineIncomingCall} />
          <SessionButton
            text={window.i18n('accept')}
            onClick={handleAcceptIncomingCall}
            buttonColor={SessionButtonColor.Green}
          />
        </div>
      </SessionWrapperModal>
    );
  }
  // display spinner while connecting
  return null;
};
