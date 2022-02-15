import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getSelectedConversation } from '../../state/selectors/conversations';

export const ConversationRequestinfo = () => {
  const selectedConversation = useSelector(getSelectedConversation);
  const showMsgRequestUI =
    !selectedConversation?.isApproved && selectedConversation?.type === 'private';

  if (!showMsgRequestUI) {
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

const ConversationRequestTextBottom = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  padding: var(--margins-lg);
`;

const ConversationRequestTextInner = styled.div`
  color: var(--color-text-subtle);
  text-align: center;
  max-width: 390px;
`;
