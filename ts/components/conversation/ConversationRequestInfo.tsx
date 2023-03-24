import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useIsRequest } from '../../hooks/useParamSelector';
import { hasSelectedConversationIncomingMessages } from '../../state/selectors/conversations';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';

const ConversationRequestTextBottom = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  padding: var(--margins-lg);
  background-color: var(--background-secondary-color);
`;

const ConversationRequestTextInner = styled.div`
  color: var(--text-secondary-color);
  text-align: center;
  max-width: 390px;
`;

export const ConversationRequestinfo = () => {
  const selectedConversation = useSelectedConversationKey();
  const isIncomingMessageRequest = useIsRequest(selectedConversation);

  const showMsgRequestUI = selectedConversation && isIncomingMessageRequest;
  const hasIncomingMessages = useSelector(hasSelectedConversationIncomingMessages);

  if (!showMsgRequestUI || !hasIncomingMessages) {
    return null;
  }

  return (
    <ConversationRequestTextBottom>
      <ConversationRequestTextInner>
        {window.i18n('respondingToRequestWarning')}
      </ConversationRequestTextInner>
    </ConversationRequestTextBottom>
  );
};
