import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useInterval } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../../../data/data';
import { getConversationController } from '../../../../session/conversations';
import { messagesExpired, PropsForExpiringMessage } from '../../../../state/ducks/conversations';
import { getIncrement } from '../../../../util/timer';
import { ExpireTimer } from '../../ExpireTimer';
import { ReadableMessage, ReadableMessageProps } from './ReadableMessage';
import { getMessageExpirationProps } from '../../../../state/selectors/conversations';
import { MessageModelType } from '../../../../models/messageType';

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

const StyledReadableMessage = styled(ReadableMessage)<{
  isIncoming: boolean;
}>`
  display: flex;
  justify-content: ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  align-items: center;
  width: 100%;
`;

export interface ExpirableReadableMessageProps
  extends Omit<ReadableMessageProps, 'receivedAt' | 'isUnread'> {
  messageId: string;
  // Note: this direction is used to override the message model direction in cases where it isn't set i.e. Timer Notifications rely on the 'type' prop to determine direction
  direction?: MessageModelType;
  isCentered?: boolean;
  marginInlineStart?: string;
  marginInlineEnd?: string;
}

export const ExpirableReadableMessage = (props: ExpirableReadableMessageProps) => {
  const selected = useSelector(state => getMessageExpirationProps(state as any, props.messageId));

  if (!selected) {
    return null;
  }

  const {
    direction: overrideDirection,
    isCentered,
    marginInlineStart = '6px',
    marginInlineEnd = '6px',
  } = props;

  const {
    convoId,
    messageId,
    direction: selectedDirection,
    receivedAt,
    isUnread,
    expirationLength,
    expirationTimestamp,
    isExpired: _isExpired,
  } = selected;

  const direction = overrideDirection || selectedDirection;

  const { isExpired } = useIsExpired({
    convoId,
    messageId,
    direction,
    expirationTimestamp,
    expirationLength,
    isExpired: _isExpired,
  });

  if (isExpired) {
    return null;
  }

  const isIncoming = direction === 'incoming';

  return (
    <StyledReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={!!isUnread}
      isIncoming={isIncoming}
      key={`readable-message-${messageId}`}
    >
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
          style={{
            display: !isCentered && isIncoming ? 'none' : 'block',
            visibility: !isIncoming ? 'visible' : 'hidden',
            marginInlineStart,
          }}
        />
      )}
      {props.children}
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
          style={{
            display: !isCentered && !isIncoming ? 'none' : 'block',
            visibility: isIncoming ? 'visible' : 'hidden',
            marginInlineEnd,
          }}
        />
      )}
    </StyledReadableMessage>
  );
};
