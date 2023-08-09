import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useInterval } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../../../data/data';
import { getConversationController } from '../../../../session/conversations';
import { messagesExpired, PropsForExpiringMessage } from '../../../../state/ducks/conversations';
import { getIncrement } from '../../../../util/timer';
import { ExpireTimer } from '../../ExpireTimer';
import { ReadableMessage, ReadableMessageProps } from './ReadableMessage';
import { MessageModelType } from '../../../../models/messageType';
import { useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';

const EXPIRATION_CHECK_MINIMUM = 2000;

// TODO Check that this isn't broken
function useIsExpired(
  props: Omit<PropsForExpiringMessage, 'messageId' | 'direction'> & {
    messageId: string | undefined;
    direction: MessageModelType | undefined;
  }
) {
  const {
    convoId,
    messageId,
    direction,
    expirationLength,
    expirationTimestamp,
    isExpired: isExpiredProps,
  } = props;

  const dispatch = useDispatch();

  const [isExpired] = useState(isExpiredProps);

  const checkExpired = useCallback(async () => {
    const now = Date.now();

    if (!messageId || !direction || !expirationTimestamp || !expirationLength) {
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
  }, [messageId, direction, expirationTimestamp, expirationLength, isExpired, convoId, dispatch]);

  let checkFrequency: number | null = null;
  if (expirationLength) {
    const increment = getIncrement(expirationLength || EXPIRATION_CHECK_MINIMUM);
    checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);
  }

  useEffect(() => {
    void checkExpired();
  }, [checkExpired]); // check on mount

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
  const selected = useMessageExpirationPropsById(props.messageId);

  const {
    direction,
    isCentered,
    marginInlineStart = '6px',
    marginInlineEnd = '6px',
    dataTestId,
  } = props;

  const { isExpired } = useIsExpired({
    convoId: selected?.convoId,
    messageId: selected?.messageId,
    direction: direction || selected?.direction,
    expirationTimestamp: selected?.expirationTimestamp,
    expirationLength: selected?.expirationLength,
    isExpired: selected?.isExpired,
  });

  if (!selected || isExpired) {
    return null;
  }

  const { messageId, receivedAt, isUnread, expirationLength, expirationTimestamp } = selected;

  const isIncoming = direction === 'incoming';

  return (
    <StyledReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={!!isUnread}
      isIncoming={isIncoming}
      key={`readable-message-${messageId}`}
      dataTestId={dataTestId}
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
