import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../interactions/types';

export type CallNotificationType = 'missed-call' | 'started-call' | 'answered-a-call';

export type PropsForCallNotification = {
  notificationType: CallNotificationType;
  messageId: string;
};

export type LastMessageStatusType = 'sending' | 'sent' | 'read' | 'error' | undefined;

export type LastMessageType = {
  status: LastMessageStatusType;
  text: string | null;
  interactionType: ConversationInteractionType | null;
  interactionStatus: ConversationInteractionStatus | null;
};

export type InteractionNotificationType = {
  interactionType: ConversationInteractionType;
  interactionStatus: ConversationInteractionStatus;
};

export type PropsForInteractionNotification = {
  notificationType: InteractionNotificationType;
  convoId: string;
  messageId: string;
  receivedAt: number;
  isUnread: boolean;
};
