import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useIsRequest } from '../../hooks/useParamSelector';
import {
  approveConvoAndSendResponse,
  declineConversationWithConfirm,
} from '../../interactions/conversationInteractions';
import { getConversationController } from '../../session/conversations';
import {
  getSelectedConversation,
  hasSelectedConversationIncomingMessages,
} from '../../state/selectors/conversations';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';

const handleDeclineConversationRequest = (convoId: string) => {
  declineConversationWithConfirm(convoId, true);
};

const handleAcceptConversationRequest = async (convoId: string) => {
  const convo = getConversationController().get(convoId);
  await convo.setDidApproveMe(true);
  await convo.addOutgoingApprovalMessage(Date.now());
  await approveConvoAndSendResponse(convoId, true);
};

export const ConversationMessageRequestButtons = () => {
  const selectedConversation = useSelector(getSelectedConversation);

  const hasIncomingMessages = useSelector(hasSelectedConversationIncomingMessages);
  const isIncomingMessageRequest = useIsRequest(selectedConversation?.id);

  if (!selectedConversation || !hasIncomingMessages) {
    return null;
  }

  if (!isIncomingMessageRequest) {
    return null;
  }

  return (
    <ConversationRequestBanner>
      <ConversationBannerRow>
        <SessionButton
          buttonColor={SessionButtonColor.Primary}
          onClick={async () => {
            await handleAcceptConversationRequest(selectedConversation.id);
          }}
          text={window.i18n('accept')}
          dataTestId="accept-message-request"
        />
        <SessionButton
          buttonColor={SessionButtonColor.Danger}
          text={window.i18n('decline')}
          onClick={() => {
            handleDeclineConversationRequest(selectedConversation.id);
          }}
          dataTestId="decline-message-request"
        />
      </ConversationBannerRow>
    </ConversationRequestBanner>
  );
};

const ConversationBannerRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: var(--margins-lg);
  justify-content: center;
`;

const ConversationRequestBanner = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--margins-lg);
  gap: var(--margins-lg);
`;
