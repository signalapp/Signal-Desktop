import { LocalizerType } from '../../ts/types/Util';
import { ConversationModel } from './conversations';

type MessageModelType = 'incoming' | 'outgoing';
type MessageDeliveryStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'error';

interface MessageAttributes {
  id: number;
  source: string;
  quote: any;
  expireTimer: number;
  received_at: number;
  sent_at: number;
  preview: any;
  body: string;
  expirationStartTimestamp: any;
  read_by: Array<string>;
  delivered_to: Array<string>;
  decrypted_at: number;
  recipients: Array<string>;
  delivered: number;
  type: MessageModelType;
  group_update: any;
  groupInvitation: any;
  attachments: any;
  contact: any;
  conversationId: any;
  errors: any;
  flags: number;
  hasAttachments: boolean;
  hasFileAttachments: boolean;
  hasVisualMediaAttachments: boolean;
  schemaVersion: number;
  expirationTimerUpdate: any;
  unread: boolean;
  group: any;
  timestamp: number;
  status: MessageDeliveryStatus;
}

export interface MessageRegularProps {
  disableMenu?: boolean;
  isDeletable: boolean;
  isAdmin?: boolean;
  weAreAdmin?: boolean;
  text?: string;
  id: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  serverTimestamp?: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error' | 'pow';
  // What if changed this over to a single contact like quote, and put the events on it?
  contact?: Contact & {
    onSendMessage?: () => void;
    onClick?: () => void;
  };
  authorName?: string;
  authorProfileName?: string;
  /** Note: this should be formatted for display */
  authorPhoneNumber: string;
  conversationType: 'group' | 'direct';
  attachments?: Array<AttachmentType>;
  quote?: {
    text: string;
    attachment?: QuotedAttachmentType;
    isFromMe: boolean;
    authorPhoneNumber: string;
    authorProfileName?: string;
    authorName?: string;
    messageId?: string;
    onClick: (data: any) => void;
    referencedMessageNotFound: boolean;
  };
  previews: Array<LinkPreviewType>;
  authorAvatarPath?: string;
  isExpired: boolean;
  expirationLength?: number;
  expirationTimestamp?: number;
  convoId: string;
  isPublic?: boolean;
  selected: boolean;
  isKickedFromGroup: boolean;
  // whether or not to show check boxes
  multiSelectMode: boolean;
  firstMessageOfSeries: boolean;
  isUnread: boolean;
  isQuotedMessageToAnimate?: boolean;

  onClickAttachment?: (attachment: AttachmentType) => void;
  onClickLinkPreview?: (url: string) => void;
  onCopyText?: () => void;
  onSelectMessage: (messageId: string) => void;
  onReply?: (messagId: number) => void;
  onRetrySend?: () => void;
  onDownload?: (attachment: AttachmentType) => void;
  onDeleteMessage: (messageId: string) => void;
  onCopyPubKey?: () => void;
  onBanUser?: () => void;
  onShowDetail: () => void;
  onShowUserDetails: (userPubKey: string) => void;
  markRead: (readAt: number) => Promise<void>;
  theme: DefaultTheme;
}

export interface MessageModel extends Backbone.Model<MessageAttributes> {
  idForLogging: () => string;
  isGroupUpdate: () => boolean;
  isExpirationTimerUpdate: () => boolean;
  getNotificationText: () => string;
  markRead: () => void;
  merge: (other: MessageModel) => void;
  saveErrors: (error: any) => void;
  sendSyncMessageOnly: (message: any) => void;
  isUnread: () => boolean;
  commit: () => Promise<number>;
  getPropsForMessageDetail: () => any;
  getConversation: () => ConversationModel;
  handleMessageSentSuccess: (sentMessage: any, wrappedEnvelope: any) => any;
  handleMessageSentFailure: (sentMessage: any, error: any) => any;

  propsForMessage?: MessageRegularProps;
  propsForTimerNotification?: any;
  propsForGroupInvitation?: any;
  propsForGroupNotification?: any;
  firstMessageOfSeries: boolean;
}
