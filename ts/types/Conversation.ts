import { LastMessageStatusType } from '../state/ducks/conversations';
import { Message } from './Message';

interface ConversationLastMessageUpdate {
  lastMessage: string;
  lastMessageStatus: LastMessageStatusType;
  timestamp: number | undefined;
}

export const createLastMessageUpdate = ({
  currentTimestamp,
  lastMessage,
  lastMessageStatus,
  lastMessageNotificationText,
}: {
  currentTimestamp?: number;
  lastMessage?: Message;
  lastMessageStatus?: LastMessageStatusType;
  lastMessageNotificationText?: string;
}): ConversationLastMessageUpdate => {
  if (!lastMessage) {
    return {
      lastMessage: '',
      lastMessageStatus: undefined,
      timestamp: undefined,
    };
  }

  const { expirationTimerUpdate } = lastMessage;
  const isExpireTimerUpdateFromSync = Boolean(
    expirationTimerUpdate && expirationTimerUpdate.fromSync
  );

  const shouldUpdateTimestamp = Boolean(!isExpireTimerUpdateFromSync);
  const newTimestamp = shouldUpdateTimestamp ? lastMessage.sent_at : currentTimestamp;

  return {
    lastMessage: lastMessageNotificationText || '',
    lastMessageStatus: lastMessageStatus || undefined,
    timestamp: newTimestamp || undefined,
  };
};
