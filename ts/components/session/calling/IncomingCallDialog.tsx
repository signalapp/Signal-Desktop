import React from 'react';
import { useSelector } from 'react-redux';

import styled from 'styled-components';
import _ from 'underscore';
import { CallManager } from '../../../session/utils';
import { getHasIncomingCall, getHasIncomingCallFrom } from '../../../state/selectors/conversations';
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

// TODO:
/**
 * Add mute input, deafen, end call, possibly add person to call
 * duration - look at how duration calculated for recording.
 */
export const IncomingCallDialog = () => {
  const hasIncomingCall = useSelector(getHasIncomingCall);
  const incomingCallProps = useSelector(getHasIncomingCallFrom);

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

  if (!hasIncomingCall) {
    return null;
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
