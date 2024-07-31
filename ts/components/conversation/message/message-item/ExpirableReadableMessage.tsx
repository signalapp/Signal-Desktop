import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import useMount from 'react-use/lib/useMount';
import styled from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { Data } from '../../../../data/data';
import { useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';
import { MessageModelType } from '../../../../models/messageType';
import { getConversationController } from '../../../../session/conversations';
import { PropsForExpiringMessage, messagesExpired } from '../../../../state/ducks/conversations';
import { getIncrement } from '../../../../util/timer';
import { ExpireTimer } from '../../ExpireTimer';
import { ReadableMessage, ReadableMessageProps } from './ReadableMessage';

const EXPIRATION_CHECK_MINIMUM = 2000;

function useIsExpired(
  props: Omit<PropsForExpiringMessage, 'messageId' | 'direction'> & {
    messageId: string | undefined;
    direction: MessageModelType | undefined;
  }
) {
  const {
    convoId,
    messageId,
    expirationDurationMs,
    expirationTimestamp,
    isExpired: isExpiredProps,
  } = props;

  const dispatch = useDispatch();

  const [isExpired] = useState(isExpiredProps);

  const checkExpired = useCallback(async () => {
    const now = Date.now();

    if (!messageId || !expirationTimestamp || !expirationDurationMs) {
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
  }, [messageId, expirationTimestamp, expirationDurationMs, isExpired, convoId, dispatch]);

  let checkFrequency: number | null = null;
  if (expirationDurationMs) {
    const increment = getIncrement(expirationDurationMs || EXPIRATION_CHECK_MINIMUM);
    checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);
  }

  useMount(() => {
    void checkExpired();
  }); // check on mount

  useInterval(checkExpired, checkFrequency); // check every 2sec or sooner if needed

  return { isExpired };
}

const StyledReadableMessage = styled(ReadableMessage)<{
  isIncoming: boolean;
}>`
  display: flex;
  justify-content: flex-end; // ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  align-items: ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  width: 100%;
  flex-direction: column;
`;

export interface ExpirableReadableMessageProps
  extends Omit<ReadableMessageProps, 'receivedAt' | 'isUnread'> {
  messageId: string;
  isControlMessage?: boolean;
}

function ExpireTimerControlMessage({
  expirationTimestamp,
  expirationDurationMs,
  isControlMessage,
}: {
  expirationDurationMs: number | null | undefined;
  expirationTimestamp: number | null | undefined;
  isControlMessage: boolean | undefined;
}) {
  if (!isControlMessage) {
    return null;
  }
  return (
    <ExpireTimer
      expirationDurationMs={expirationDurationMs || undefined}
      expirationTimestamp={expirationTimestamp}
    />
  );
}

export const ExpirableReadableMessage = (props: ExpirableReadableMessageProps) => {
  const selected = useMessageExpirationPropsById(props.messageId);
  const isDetailView = useIsDetailMessageView();

  const { isControlMessage, onClick, onDoubleClickCapture, role, dataTestId } = props;

  const { isExpired } = useIsExpired({
    convoId: selected?.convoId,
    messageId: selected?.messageId,
    direction: selected?.direction,
    expirationTimestamp: selected?.expirationTimestamp,
    expirationDurationMs: selected?.expirationDurationMs,
    isExpired: selected?.isExpired,
  });

  if (!selected || isExpired) {
    return null;
  }

  const {
    messageId,
    direction: _direction,
    receivedAt,
    isUnread,
    expirationDurationMs,
    expirationTimestamp,
  } = selected;

  // NOTE we want messages on the left in the message detail view regardless of direction
  const direction = isDetailView ? 'incoming' : _direction;
  const isIncoming = direction === 'incoming';

  return (
    <StyledReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={!!isUnread}
      isIncoming={isIncoming}
      onClick={onClick}
      onDoubleClickCapture={onDoubleClickCapture}
      role={role}
      key={`readable-message-${messageId}`}
      dataTestId={dataTestId}
    >
      <ExpireTimerControlMessage
        expirationDurationMs={expirationDurationMs}
        expirationTimestamp={expirationTimestamp}
        isControlMessage={isControlMessage}
      />
      {props.children}
    </StyledReadableMessage>
  );
};
