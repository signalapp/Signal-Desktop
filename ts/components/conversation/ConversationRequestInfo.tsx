import React from 'react';
import styled from 'styled-components';
import { ReduxConversationType } from '../../state/ducks/conversations';

export const ConversationRequestinfo = (props: { selectedConversation: ReduxConversationType }) => {
  const { selectedConversation } = props;
  const { isApproved, type } = selectedConversation;
  const showMsgRequestUI = !isApproved && type === 'private';

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
