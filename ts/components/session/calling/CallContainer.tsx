import React from 'react';
import { useSelector } from 'react-redux';
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
  padding: 2rem;
  top: 50vh;
  left: 50vw;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
`;

// similar styling to modal header
const CallWindowHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  padding: $session-margin-lg;

  font-family: $session-font-default;
  text-align: center;
  line-height: 18px;
  font-size: $session-font-md;
  font-weight: 700;
`;

// TODO: Add proper styling for this
const VideoContainer = styled.video`
  width: 200px;
  height: 200px;
`;

const CallWindowInner = styled.div`
  position: relative;
  background-color: pink;
  border: 1px solid #d3d3d3;
  text-align: center;
  padding: 2rem;
  display: flex;
  flex-direction: column;
`;

const CallWindowControls = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  /* background: green; */
  padding: 5px;
  transform: translateY(-100%);
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
      <CallWindow>
        <CallWindowInner>
          <CallWindowHeader>{ongoingCallProps.name}</CallWindowHeader>
          <VideoContainer />
          <CallWindowControls>
            <SessionButton text={'end call'} onClick={handleEndCall} />
          </CallWindowControls>
        </CallWindowInner>
      </CallWindow>
    );
  }

  if (hasIncomingCall) {
    return (
      <SessionWrapperModal title={'incoming call'}>
        <div className="session-modal__button-group">
          <SessionButton text={'decline'} onClick={handleDeclineIncomingCall} />
          <SessionButton
            text={'accept'}
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
