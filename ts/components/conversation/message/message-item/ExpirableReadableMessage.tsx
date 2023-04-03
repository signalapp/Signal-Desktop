import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useInterval } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../../../data/data';
import { MessageModelType } from '../../../../models/messageType';
import { getConversationController } from '../../../../session/conversations';
import { messagesExpired, PropsForExpiringMessage } from '../../../../state/ducks/conversations';
import { getIncrement } from '../../../../util/timer';
import { ExpireTimer } from '../../ExpireTimer';
import { ReadableMessage, ReadableMessageProps } from './ReadableMessage';

const EXPIRATION_CHECK_MINIMUM = 2000;

function useIsExpired(props: PropsForExpiringMessage) {
  const {
    convoId,
    messageId,
    expirationLength,
    expirationTimestamp,
    isExpired: isExpiredProps,
  } = props;

  const dispatch = useDispatch();

  const [isExpired] = useState(isExpiredProps);

  const checkExpired = useCallback(async () => {
    const now = Date.now();

    if (!expirationTimestamp || !expirationLength) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
      await Data.removeMessage(messageId);
      if (convoId) {
        dispatch(
          messagesExpired([
            {
              conversationKey: convoId,
              messageId,
            },
          ])
        );
        const convo = getConversationController().get(convoId);
        convo?.updateLastMessage();
      }
    }
  }, [expirationTimestamp, expirationLength, isExpired, messageId, convoId]);

  let checkFrequency: number | null = null;
  if (expirationLength) {
    const increment = getIncrement(expirationLength || EXPIRATION_CHECK_MINIMUM);
    checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);
  }

  useEffect(() => {
    void checkExpired();
  }, []); // check on mount

  useInterval(checkExpired, checkFrequency); // check every 2sec or sooner if needed

  return { isExpired };
}

const StyledReadableMessage = styled(ReadableMessage)`
  display: flex;
  align-items: center;
  width: 100%;
`;

export interface ExpirableReadableMessageProps
  extends ReadableMessageProps,
    PropsForExpiringMessage {
  direction: MessageModelType;
}

export const ExpirableReadableMessage = (props: ExpirableReadableMessageProps) => {
  const {
    convoId,
    messageId,
    direction,
    receivedAt,
    isUnread,
    expirationLength,
    expirationTimestamp,
  } = props;

  const expiringProps: PropsForExpiringMessage = {
    convoId,
    messageId: messageId,
    expirationLength,
    expirationTimestamp,
    isExpired: props.isExpired,
  };
  const { isExpired } = useIsExpired(expiringProps);
  const isIncoming = direction === 'incoming';

  if (isExpired) {
    return null;
  }

  return (
    <StyledReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={!!isUnread}
      key={`readable-message-${messageId}`}
    >
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          isCorrectSide={!isIncoming}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
        />
      )}
      {props.children}
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          isCorrectSide={isIncoming}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
        />
      )}
    </StyledReadableMessage>
  );
};
