import { Message } from './Message';

interface ConversationLastMessageUpdate {
  lastMessage: string;
  lastMessageStatus: string | null;
  timestamp: number | null;
}

export const createLastMessageUpdate = ({
  currentTimestamp,
  lastMessage,
  lastMessageStatus,
  lastMessageNotificationText,
}: {
  currentTimestamp?: number;
  lastMessage?: Message;
  lastMessageStatus?: string;
  lastMessageNotificationText?: string;
}): ConversationLastMessageUpdate => {
  if (!lastMessage) {
    return {
      lastMessage: '',
      lastMessageStatus: null,
      timestamp: null,
    };
  }

  const { expirationTimerUpdate } = lastMessage;
  const isExpireTimerUpdateFromSync = Boolean(
    expirationTimerUpdate && expirationTimerUpdate.fromSync
  );

  const shouldUpdateTimestamp = Boolean(!isExpireTimerUpdateFromSync);
  const newTimestamp = shouldUpdateTimestamp
    ? lastMessage.sent_at
    : currentTimestamp;

  return {
    lastMessage: lastMessageNotificationText || '',
    lastMessageStatus: lastMessageStatus || null,
    timestamp: newTimestamp || null,
  };
};
