/**
 * @prettier
 */
import is from '@sindresorhus/is';
import { Message } from './Message';

interface ConversationLastMessageUpdate {
  lastMessage: string | null;
  timestamp: number | null;
}

export const createLastMessageUpdate = ({
  currentLastMessageText,
  currentTimestamp,
  lastMessage,
  lastMessageNotificationText,
}: {
  currentLastMessageText: string | null;
  currentTimestamp: number | null;
  lastMessage: Message | null;
  lastMessageNotificationText: string | null;
}): ConversationLastMessageUpdate => {
  if (lastMessage === null) {
    return {
      lastMessage: '',
      timestamp: null,
    };
  }

  const { type } = lastMessage;
  const isVerifiedChangeMessage = type === 'verified-change';
  const isExpiringMessage = is.object(lastMessage.expirationTimerUpdate);
  const shouldUpdateTimestamp = !isVerifiedChangeMessage && !isExpiringMessage;

  const newTimestamp = shouldUpdateTimestamp
    ? lastMessage.sent_at
    : currentTimestamp;

  const shouldUpdateLastMessageText = !isVerifiedChangeMessage;
  const newLastMessageText = shouldUpdateLastMessageText
    ? lastMessageNotificationText
    : currentLastMessageText;

  return {
    lastMessage: newLastMessageText,
    timestamp: newTimestamp,
  };
};
