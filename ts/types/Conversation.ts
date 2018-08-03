import { Message } from './Message';

interface ConversationLastMessageUpdate {
  lastMessage: string | null;
  lastMessageStatus: string | null;
  timestamp: number | null;
}

export const createLastMessageUpdate = ({
  currentLastMessageText,
  currentTimestamp,
  lastMessage,
  lastMessageStatus,
  lastMessageNotificationText,
}: {
  currentLastMessageText: string | null;
  currentTimestamp: number | null;
  lastMessage: Message | null;
  lastMessageStatus: string | null;
  lastMessageNotificationText: string | null;
}): ConversationLastMessageUpdate => {
  if (lastMessage === null) {
    return {
      lastMessage: '',
      lastMessageStatus: null,
      timestamp: null,
    };
  }

  const { type, expirationTimerUpdate } = lastMessage;
  const isVerifiedChangeMessage = type === 'verified-change';
  const isExpireTimerUpdateFromSync =
    expirationTimerUpdate && expirationTimerUpdate.fromSync;
  const shouldUpdateTimestamp =
    !isVerifiedChangeMessage && !isExpireTimerUpdateFromSync;

  const newTimestamp = shouldUpdateTimestamp
    ? lastMessage.sent_at
    : currentTimestamp;

  const shouldUpdateLastMessageText = !isVerifiedChangeMessage;
  const newLastMessageText = shouldUpdateLastMessageText
    ? lastMessageNotificationText
    : currentLastMessageText;

  return {
    lastMessage: newLastMessageText,
    lastMessageStatus,
    timestamp: newTimestamp,
  };
};
