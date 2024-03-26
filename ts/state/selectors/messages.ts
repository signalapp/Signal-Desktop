import { useSelector } from 'react-redux';
import { UserUtils } from '../../session/utils';
import {
  LastMessageStatusType,
  MessageModelPropsWithConvoProps,
  PropsForAttachment,
  PropsForQuote,
  ReduxConversationType,
} from '../ducks/conversations';
import { StateType } from '../reducer';
import { getIsMessageSelected, getMessagePropsByMessageId } from './conversations';
import { useSelectedIsPrivate } from './selectedConversation';

function useMessagePropsByMessageId(messageId: string | undefined) {
  return useSelector((state: StateType) => getMessagePropsByMessageId(state, messageId));
}

const useSenderConvoProps = (
  msgProps: MessageModelPropsWithConvoProps | undefined
): ReduxConversationType | undefined => {
  return useSelector((state: StateType) => {
    const sender = msgProps?.propsForMessage.sender;
    if (!sender) {
      return undefined;
    }
    return state.conversations.conversationLookup[sender] || undefined;
  });
};

export const useAuthorProfileName = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  const senderIsUs = msg.propsForMessage.sender === UserUtils.getOurPubKeyStrFromCache();

  const authorProfileName = senderIsUs
    ? window.i18n('you')
    : senderProps.nickname || senderProps.displayNameInProfile || window.i18n('anonymous');
  return authorProfileName || window.i18n('unknown');
};

export const useAuthorName = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  const authorName = senderProps.nickname || senderProps.displayNameInProfile || null;
  return authorName;
};

export const useAuthorAvatarPath = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  return senderProps.avatarPath || null;
};

export const useMessageIsDeleted = (messageId: string): boolean => {
  const props = useMessagePropsByMessageId(messageId);
  return props?.propsForMessage.isDeleted || false;
};

export const useFirstMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.firstMessageOfSeries || false;
};

export const useLastMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.lastMessageOfSeries || false;
};

export const useMessageAuthor = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.sender;
};

export const useMessageDirection = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.direction;
};

export const useMessageLinkPreview = (messageId: string | undefined): Array<any> | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.previews;
};

export const useMessageAttachments = (
  messageId: string | undefined
): Array<PropsForAttachment> | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.attachments;
};

export const useMessageSenderIsAdmin = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isSenderAdmin || false;
};

export const useMessageIsDeletable = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isDeletable || false;
};

export const useMessageStatus = (
  messageId: string | undefined
): LastMessageStatusType | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.status;
};

export function useMessageSender(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.sender;
}

export function useMessageIsDeletableForEveryone(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isDeletableForEveryone;
}

export function useMessageServerTimestamp(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.serverTimestamp;
}

export function useMessageReceivedAt(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.receivedAt;
}

export function useMessageTimestamp(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.timestamp;
}

export function useMessageBody(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.text;
}

export const useMessageQuote = (messageId: string | undefined): PropsForQuote | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.quote;
};

export const useMessageHash = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.messageHash;
};

export const useMessageExpirationType = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.expirationType;
};

export const useMessageExpirationDurationMs = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.expirationDurationMs;
};

export const useMessageExpirationTimestamp = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.expirationTimestamp;
};

export const useMessageServerId = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.serverId;
};

export const useMessageText = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.text;
};

export function useHideAvatarInMsgList(messageId?: string, isDetailView?: boolean) {
  const msgProps = useMessagePropsByMessageId(messageId);
  const selectedIsPrivate = useSelectedIsPrivate();
  return isDetailView || msgProps?.propsForMessage.direction === 'outgoing' || selectedIsPrivate;
}

export function useMessageSelected(messageId?: string) {
  return useSelector((state: StateType) => getIsMessageSelected(state, messageId));
}
