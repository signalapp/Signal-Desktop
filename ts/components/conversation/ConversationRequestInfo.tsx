import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getMessageCountByType } from '../../data/data';
import { MessageDirection } from '../../models/messageType';
import { getSelectedConversation } from '../../state/selectors/conversations';

export const ConversationRequestinfo = () => {
  const selectedConversation = useSelector(getSelectedConversation);
  const showMsgRequestUI =
    !selectedConversation?.isApproved && selectedConversation?.type === 'private';
  const [hasIncomingMessages, setHasIncomingMessages] = useState(false);
  const [incomingChecked, setIncomingChecked] = useState(false);

  useEffect(() => {
    async function getIncomingMessages() {
      const id = selectedConversation?.id;
      if (id) {
        const msgCount = await getMessageCountByType(
          selectedConversation?.id,
          MessageDirection.incoming
        );
        if (msgCount > 0) {
          setHasIncomingMessages(true);
        } else {
          setHasIncomingMessages(false);
        }
        setIncomingChecked(true);
      }
    }
    // tslint:disable-next-line: no-floating-promises
    getIncomingMessages();
  });

  if (!showMsgRequestUI || !hasIncomingMessages || !incomingChecked) {
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
