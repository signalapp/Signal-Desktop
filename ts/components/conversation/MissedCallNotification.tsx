import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { PubKey } from '../../session/types';

import { PropsForMissedCallNotification } from '../../state/ducks/conversations';
import { getSelectedConversation } from '../../state/selectors/conversations';
import { ReadableMessage } from './ReadableMessage';

export const StyledFakeMessageBubble = styled.div`
  background: var(--color-fake-chat-bubble-background);
  color: var(--color-text);

  width: 90%;
  max-width: 700px;
  margin: 10px auto;
  padding: 5px 0px;
  border-radius: 4px;
  word-break: break-word;
  text-align: center;
`;

export const MissedCallNotification = (props: PropsForMissedCallNotification) => {
  const { messageId, receivedAt, isUnread } = props;

  const selectedConvoProps = useSelector(getSelectedConversation);

  const displayName =
    selectedConvoProps?.profileName ||
    selectedConvoProps?.name ||
    (selectedConvoProps?.id && PubKey.shorten(selectedConvoProps?.id));

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <StyledFakeMessageBubble>{window.i18n('callMissed', displayName)}</StyledFakeMessageBubble>
    </ReadableMessage>
  );
};
