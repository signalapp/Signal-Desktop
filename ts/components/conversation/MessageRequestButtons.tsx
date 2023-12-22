import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useIsIncomingRequest } from '../../hooks/useParamSelector';
import {
  approveConvoAndSendResponse,
  declineConversationWithConfirm,
} from '../../interactions/conversationInteractions';
import { getConversationController } from '../../session/conversations';
import { hasSelectedConversationIncomingMessages } from '../../state/selectors/conversations';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { ConversationRequestExplanation } from './SubtleNotification';

const ConversationRequestBanner = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--margins-lg);
  gap: var(--margins-lg);
  background-color: var(--background-secondary-color);
`;

const ConversationBannerRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: var(--margins-lg);
  justify-content: center;

  .session-button {
    padding: 0 36px;
  }
`;

const StyledBlockUserText = styled.span`
  color: var(--danger-color);
  cursor: pointer;
  font-size: var(--font-size-md);
  align-self: center;
  font-weight: 700;
`;

const handleDeclineConversationRequest = (convoId: string, currentSelected: string | undefined) => {
  declineConversationWithConfirm({
    conversationId: convoId,
    syncToDevices: true,
    blockContact: false,
    currentlySelectedConvo: currentSelected,
  });
};

const handleDeclineAndBlockConversationRequest = (
  convoId: string,
  currentSelected: string | undefined
) => {
  declineConversationWithConfirm({
    conversationId: convoId,
    syncToDevices: true,
    blockContact: true,
    currentlySelectedConvo: currentSelected,
  });
};

const handleAcceptConversationRequest = async (convoId: string) => {
  const convo = getConversationController().get(convoId);
  if (!convo) {
    return;
  }
  await convo.setDidApproveMe(true, false);
  await convo.setIsApproved(true, false);
  await convo.commit();
  await convo.addOutgoingApprovalMessage(Date.now());
  await approveConvoAndSendResponse(convoId);
};

export const ConversationMessageRequestButtons = () => {
  const selectedConvoId = useSelectedConversationKey();

  const hasIncomingMessages = useSelector(hasSelectedConversationIncomingMessages);
  const isIncomingRequest = useIsIncomingRequest(selectedConvoId);

  if (!selectedConvoId || !hasIncomingMessages) {
    return null;
  }

  if (!isIncomingRequest) {
    return null;
  }

  return (
    <ConversationRequestBanner>
      <StyledBlockUserText
        onClick={() => {
          handleDeclineAndBlockConversationRequest(selectedConvoId, selectedConvoId);
        }}
        data-testid="decline-and-block-message-request"
      >
        {window.i18n('block')}
      </StyledBlockUserText>

      <ConversationRequestExplanation />

      <ConversationBannerRow>
        <SessionButton
          onClick={async () => {
            await handleAcceptConversationRequest(selectedConvoId);
          }}
          text={window.i18n('accept')}
          dataTestId="accept-message-request"
        />
        <SessionButton
          buttonColor={SessionButtonColor.Danger}
          text={window.i18n('decline')}
          onClick={() => {
            handleDeclineConversationRequest(selectedConvoId, selectedConvoId);
          }}
          dataTestId="decline-message-request"
        />
      </ConversationBannerRow>
    </ConversationRequestBanner>
  );
};
