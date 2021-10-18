import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { PubKey } from '../../session/types';

import { PropsForMissedCallNotification } from '../../state/ducks/conversations';
import { getSelectedConversation } from '../../state/selectors/conversations';
import { ReadableMessage } from './ReadableMessage';

const MissedCallContent = styled.div`
  background-color: red;
  width: 100%;
  height: 30px;
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
      <MissedCallContent>{window.i18n('callMissed', displayName)}</MissedCallContent>
    </ReadableMessage>
  );
};
