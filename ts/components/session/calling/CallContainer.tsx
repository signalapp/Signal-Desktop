import React, { useState } from 'react';
import styled from 'styled-components';
import _ from 'underscore';
import { ConversationModel } from '../../../models/conversation';
// tslint:disable-next-line: no-submodule-imports
import { getConversationController } from '../../../session/conversations/ConversationController';
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
const StreamContainer = styled.div`
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

type CallStateType = 'connecting' | 'ongoing' | 'incoming' | null

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
    const randomConversation = _.sample(conversations) as ConversationModel;
    randomConversation.callState = 'incoming';
    console.warn({ randConvo: randomConversation });

    const firstCallingConvo = _.first(conversations.filter(convo => convo.callState !== undefined));

    //#region input handlers
    const handleAcceptIncomingCall = () => {
        console.warn('accept call');

        if (firstCallingConvo) {
            setConnectionState('connecting');
            firstCallingConvo.callState = 'connecting';

            // some delay
            setConnectionState('ongoing');
            firstCallingConvo.callState = 'ongoing';
        }
        // set conversationState = setting up
    }

    const handleDeclineIncomingCall = () => {
        // set conversation.callState = null or undefined
        // close the modal
        if (firstCallingConvo) {
            firstCallingConvo.callState = undefined;
        }
        console.warn('declined call');
    }

    const handleEndCall = () => {
        // call method to end call connection
        console.warn("ending the call");
        if (firstCallingConvo) {
            firstCallingConvo.callState = undefined;
        }
        setConnectionState(null);
    }

    const handleMouseDown = () => {
        // reposition call window
    }
    //#endregion

    if (connectionState === null) {
        return null;
    }

    return (
        <>
            {connectionState === 'connecting' ?
                'connecting...'
                : null
            }
            {connectionState === 'ongoing' ?
                <CallWindow onMouseDown={handleMouseDown}>
                    <CallWindowInner>
                        <CallWindowHeader>
                            { firstCallingConvo ? firstCallingConvo.getTitle() : 'Group name not found'}
                        </CallWindowHeader>
                        <StreamContainer></StreamContainer>
                        <CallWindowControls>
                            <SessionButton text={'end call'} onClick={handleEndCall} />
                        </CallWindowControls>
                    </CallWindowInner>
                </CallWindow>
                : null
            }

            {!connectionState ?
                <SessionWrapperModal title={'incoming call'}>
                    'none'
                </SessionWrapperModal>
                : null
            }

            {connectionState === 'incoming' ?
                <SessionWrapperModal title={`incoming call from ${firstCallingConvo?.getTitle()}`}>
                    <div className="session-modal__button-group">
                        <SessionButton text={'decline'} onClick={handleDeclineIncomingCall} />
                        <SessionButton
                            text={'accept'}
                            onClick={handleAcceptIncomingCall}
                            buttonColor={SessionButtonColor.Green}
                        />
                    </div>
                </SessionWrapperModal>
                : null
            }
        </>
    );
};

