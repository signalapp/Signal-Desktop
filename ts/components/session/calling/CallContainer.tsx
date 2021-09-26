import React, { useState } from 'react';
import styled from 'styled-components';
import _ from 'underscore';
import { getConversationController } from '../../../session/conversations/ConversationController';
import { CallManager } from '../../../session/utils';
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

// type WindowPositionType = {
//     top: string;
//     left: string;
// } | null;

type CallStateType = 'connecting' | 'ongoing' | 'incoming' | null;

const fakeCaller = '054774a456f15c7aca42fe8d245983549000311aaebcf58ce246250c41fe227676';

export const CallContainer = () => {
  const conversations = getConversationController().getConversations();

  // TODO:
  /**
   * Add mute input, deafen, end call, possibly add person to call
   * duration - look at how duration calculated for recording.
   */

  const [connectionState, setConnectionState] = useState<CallStateType>('incoming');
  // const [callWindowPosition, setCallWindowPosition] = useState<WindowPositionType>(null)

  // picking a conversation at random to test with
  const foundConvo = conversations.find(convo => convo.id === fakeCaller);

  if (!foundConvo) {
    throw new Error('fakeconvo not found');
  }
  foundConvo.callState = 'incoming';
  console.warn('foundConvo: ', foundConvo);

  const firstCallingConvo = _.first(conversations.filter(convo => convo.callState !== undefined));

  //#region input handlers
  const handleAcceptIncomingCall = async () => {
    console.warn('accept call');

    if (firstCallingConvo) {
      setConnectionState('connecting');
      firstCallingConvo.callState = 'connecting';
      await CallManager.USER_acceptIncomingCallRequest(fakeCaller);
      // some delay
      setConnectionState('ongoing');
      firstCallingConvo.callState = 'ongoing';
    }
    // set conversationState = setting up
  };

  const handleDeclineIncomingCall = async () => {
    // set conversation.callState = null or undefined
    // close the modal
    if (firstCallingConvo) {
      firstCallingConvo.callState = undefined;
    }
    console.warn('declined call');
    await CallManager.USER_rejectIncomingCallRequest(fakeCaller);
  };

  const handleEndCall = async () => {
    // call method to end call connection
    console.warn('ending the call');
    await CallManager.USER_rejectIncomingCallRequest(fakeCaller);
    setConnectionState(null);
  };

  const handleMouseDown = () => {
    // reposition call window
  };
  //#endregion

  if (connectionState === null) {
    return null;
  }

  return (
    <>
      {connectionState === 'connecting' ? 'connecting...' : null}
      {connectionState === 'ongoing' ? (
        <CallWindow onMouseDown={handleMouseDown}>
          <CallWindowInner>
            <CallWindowHeader>
              {firstCallingConvo ? firstCallingConvo.getName() : 'Group name not found'}
            </CallWindowHeader>
            <VideoContainer />
            <CallWindowControls>
              <SessionButton text={'end call'} onClick={handleEndCall} />
            </CallWindowControls>
          </CallWindowInner>
        </CallWindow>
      ) : null}

      {!connectionState ? (
        <SessionWrapperModal title={'incoming call'}>'none'</SessionWrapperModal>
      ) : null}

      {connectionState === 'incoming' ? (
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
      ) : null}
    </>
  );
};
