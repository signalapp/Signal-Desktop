import { Message } from './Message';

interface ConversationLastMessageUpdate {
  lastMessage: string;
  lastMessageStatus: string | null;
  timestamp: number | null;
  lastMessageDeletedForEveryone?: boolean;
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

  const { type, expirationTimerUpdate, deletedForEveryone } = lastMessage;
  const isMessageHistoryUnsynced = type === 'message-history-unsynced';
  const isVerifiedChangeMessage = type === 'verified-change';
  const isExpireTimerUpdateFromSync = Boolean(
    expirationTimerUpdate && expirationTimerUpdate.fromSync
  );

  const shouldUpdateTimestamp = Boolean(
    !isMessageHistoryUnsynced &&
      !isVerifiedChangeMessage &&
      !isExpireTimerUpdateFromSync
  );
  const newTimestamp = shouldUpdateTimestamp
    ? lastMessage.sent_at
    : currentTimestamp;

  const shouldUpdateLastMessageText = !isVerifiedChangeMessage;
  const newLastMessageText = shouldUpdateLastMessageText
    ? lastMessageNotificationText
    : '';

  return {
    lastMessage: deletedForEveryone ? '' : newLastMessageText || '',
    lastMessageStatus: lastMessageStatus || null,
    timestamp: newTimestamp || null,
    lastMessageDeletedForEveryone: deletedForEveryone,
  };
};
