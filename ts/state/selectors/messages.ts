import { useSelector } from 'react-redux';
import { UserUtils } from '../../session/utils';
import {
  MessageModelPropsWithConvoProps,
  ReduxConversationType,
  PropsForAttachment,
  ReduxQuoteType,
  LastMessageStatusType,
} from '../ducks/conversations';
import { StateType } from '../reducer';
import { getMessagePropsByMessageId } from './conversations';

const useMessageIdProps = (messageId: string | undefined) => {
  return useSelector((state: StateType) => getMessagePropsByMessageId(state, messageId));
};

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
  const msg = useMessageIdProps(messageId);
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
  const msg = useMessageIdProps(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  const authorName = senderProps.nickname || senderProps.displayNameInProfile || null;
  return authorName;
};

export const useAuthorAvatarPath = (messageId: string): string | null => {
  const msg = useMessageIdProps(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  return senderProps.avatarPath || null;
};

export const useMessageIsDeleted = (messageId: string): boolean => {
  const props = useMessageIdProps(messageId);
  return props?.propsForMessage.isDeleted || false;
};

export const useFirstMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessageIdProps(messageId)?.firstMessageOfSeries || false;
};

export const useLastMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessageIdProps(messageId)?.lastMessageOfSeries || false;
};

export const useMessageAuthor = (messageId: string | undefined): string | undefined => {
  return useMessageIdProps(messageId)?.propsForMessage.sender;
};

export const useMessageDirection = (messageId: string | undefined): string | undefined => {
  return useMessageIdProps(messageId)?.propsForMessage.direction;
};

export const useMessageLinkPreview = (messageId: string | undefined): any[] | undefined => {
  return useMessageIdProps(messageId)?.propsForMessage.previews;
};

export const useMessageAttachments = (
  messageId: string | undefined
): Array<PropsForAttachment> | undefined => {
  return useMessageIdProps(messageId)?.propsForMessage.attachments;
};

export const useMessageSenderIsAdmin = (messageId: string | undefined): boolean => {
  return useMessageIdProps(messageId)?.propsForMessage.isSenderAdmin || false;
};

export const useMessageIsDeletable = (messageId: string | undefined): boolean => {
  return useMessageIdProps(messageId)?.propsForMessage.isDeletable || false;
};

export const useMessageQuote = (messageId: string | undefined): ReduxQuoteType | undefined => {
  return useMessageIdProps(messageId)?.propsForMessage.quote;
};

export const useMessageStatus = (
  messageId: string | undefined
): LastMessageStatusType | undefined => {
  return useMessageIdProps(messageId)?.propsForMessage.status;
};
