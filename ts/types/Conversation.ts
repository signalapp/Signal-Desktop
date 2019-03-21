import { Message } from './Message';

interface ConversationLastMessageUpdate {
  lastMessage: string;
  lastMessageStatus?: string;
  timestamp?: number;
}

export const createLastMessageUpdate = ({
  currentLastMessageText,
  currentTimestamp,
  lastMessage,
  lastMessageStatus,
  lastMessageNotificationText,
}: {
  currentLastMessageText?: string;
  currentTimestamp?: number;
  lastMessage?: Message;
  lastMessageStatus?: string;
  lastMessageNotificationText?: string;
}): ConversationLastMessageUpdate => {
  if (!lastMessage) {
    return {
      lastMessage: '',
    };
  }

  const { type, expirationTimerUpdate } = lastMessage;
  const isVerifiedChangeMessage = type === 'verified-change';
  const isExpireTimerUpdateFromSync = Boolean(
    expirationTimerUpdate && expirationTimerUpdate.fromSync
  );
  const shouldUpdateTimestamp = Boolean(
    !isVerifiedChangeMessage && !isExpireTimerUpdateFromSync
  );

  const newTimestamp = shouldUpdateTimestamp
    ? lastMessage.sent_at
    : currentTimestamp;

  const shouldUpdateLastMessageText = !isVerifiedChangeMessage;
  const newLastMessageText = shouldUpdateLastMessageText
    ? lastMessageNotificationText
    : currentLastMessageText;

  return {
    lastMessage: newLastMessageText || '',
    lastMessageStatus,
    timestamp: newTimestamp,
  };
};
