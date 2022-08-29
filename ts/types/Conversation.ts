import { LastMessageStatusType } from '../state/ducks/conversations';

interface ConversationLastMessageUpdate {
  lastMessage: string;
  lastMessageStatus: LastMessageStatusType;
}

export const createLastMessageUpdate = ({
  lastMessageStatus,
  lastMessageNotificationText,
}: {
  lastMessageStatus?: LastMessageStatusType;
  lastMessageNotificationText?: string;
}): ConversationLastMessageUpdate => {
  if (!lastMessageNotificationText) {
    return {
      lastMessage: '',
      lastMessageStatus: undefined,
    };
  }

  return {
    lastMessage: lastMessageNotificationText || '',
    lastMessageStatus: lastMessageStatus || undefined,
  };
};
