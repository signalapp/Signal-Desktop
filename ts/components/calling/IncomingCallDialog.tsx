import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import styled from 'styled-components';
import { useConversationUsername } from '../../hooks/useParamSelector';
import { CallManager } from '../../session/utils';
import { callTimeoutMs } from '../../session/utils/calling/CallManager';
import { getHasIncomingCall, getHasIncomingCallFrom } from '../../state/selectors/call';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { ed25519Str } from '../../session/utils/String';

export const CallWindow = styled.div`
  position: absolute;
  z-index: 9;
  padding: 1rem;
  top: 50vh;
  left: 50vw;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  background-color: var(--modal-background-content-color);
  border: 1px solid var(--border-color);
`;

const IncomingCallAvatarContainer = styled.div`
  padding: 0 0 2rem 0;
`;

export const IncomingCallDialog = () => {
  const hasIncomingCall = useSelector(getHasIncomingCall);
  const incomingCallFromPubkey = useSelector(getHasIncomingCallFrom);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (incomingCallFromPubkey) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      timeout = global.setTimeout(async () => {
        if (incomingCallFromPubkey) {
          window.log.info(
            `call missed with ${ed25519Str(
              incomingCallFromPubkey
            )} as the dialog was not interacted with for ${callTimeoutMs} ms`
          );
          await CallManager.USER_rejectIncomingCallRequest(incomingCallFromPubkey);
        }
      }, callTimeoutMs);
    }

    return () => {
      if (timeout) {
        global.clearTimeout(timeout);
      }
    };
  }, [incomingCallFromPubkey]);

  // #region input handlers
  const handleAcceptIncomingCall = async () => {
    if (incomingCallFromPubkey) {
      await CallManager.USER_acceptIncomingCallRequest(incomingCallFromPubkey);
    }
  };

  const handleDeclineIncomingCall = async () => {
    // close the modal
    if (incomingCallFromPubkey) {
      await CallManager.USER_rejectIncomingCallRequest(incomingCallFromPubkey);
    }
  };
  const from = useConversationUsername(incomingCallFromPubkey);
  if (!hasIncomingCall || !incomingCallFromPubkey) {
    return null;
  }

  if (hasIncomingCall) {
    return (
      <SessionWrapperModal title={window.i18n('incomingCallFrom', [from || 'unknown'])}>
        <IncomingCallAvatarContainer>
          <Avatar size={AvatarSize.XL} pubkey={incomingCallFromPubkey} />
        </IncomingCallAvatarContainer>
        <div className="session-modal__button-group">
          <SessionButton
            text={window.i18n('accept')}
            buttonType={SessionButtonType.Simple}
            onClick={handleAcceptIncomingCall}
          />
          <SessionButton
            text={window.i18n('decline')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={handleDeclineIncomingCall}
          />
        </div>
      </SessionWrapperModal>
    );
  }
  // display spinner while connecting
  return null;
};
