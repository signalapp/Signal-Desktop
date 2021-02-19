import { DefaultTheme } from 'styled-components';
import _ from 'underscore';
import uuidv4 from 'uuid';
import { QuotedAttachmentType } from '../components/conversation/Quote';
import { AttachmentType } from '../types/Attachment';
import { Contact } from '../types/Contact';

export type MessageModelType = 'incoming' | 'outgoing';
export type MessageDeliveryStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'error';

export interface MessageAttributes {
  // the id of the message
  // this can have several uses:
  id: string;
  source: string;
  quote?: any;
  expireTimer: number;
  received_at?: number;
  sent_at?: number;
  destination?: string;
  preview?: any;
  body?: string;
  expirationStartTimestamp: number;
  read_by: Array<string>;
  delivered_to: Array<string>;
  decrypted_at: number;
  expires_at?: number;
  recipients: Array<string>;
  delivered?: number;
  type: MessageModelType;
  group_update?: any;
  groupInvitation?: any;
  attachments?: any;
  contact?: any;
  conversationId: any;
  errors?: any;
  flags?: number;
  hasAttachments: boolean;
  hasFileAttachments: boolean;
  hasVisualMediaAttachments: boolean;
  schemaVersion: number;
  expirationTimerUpdate?: {
    expireTimer: number;
    source: string;
    fromSync?: boolean;
    fromGroupUpdate?: boolean;
  };
  unread: boolean;
  group?: any;
  timestamp?: number;
  status: MessageDeliveryStatus;
  dataMessage: any;
  sent_to: any;
  sent: boolean;
  calculatingPoW: boolean;
  serverId?: number;
  serverTimestamp?: number;
  isPublic: boolean;
  sentSync: boolean;
  synced: boolean;
  sync: boolean;
  snippet?: any;
  direction: any;
}

export interface MessageAttributesOptionals {
  id?: string;
  source?: string;
  quote?: any;
  expireTimer?: number;
  received_at?: number;
  sent_at?: number;
  destination?: string;
  preview?: any;
  body?: string;
  expirationStartTimestamp?: number;
  read_by?: Array<string>;
  delivered_to?: Array<string>;
  decrypted_at?: number;
  expires_at?: number;
  recipients?: Array<string>;
  delivered?: number;
  type: MessageModelType;
  group_update?: any;
  groupInvitation?: any;
  attachments?: any;
  contact?: any;
  conversationId: any;
  errors?: any;
  flags?: number;
  hasAttachments?: boolean;
  hasFileAttachments?: boolean;
  hasVisualMediaAttachments?: boolean;
  schemaVersion?: number;
  expirationTimerUpdate?: {
    expireTimer: number;
    source: string;
    fromSync?: boolean;
    fromGroupUpdate?: boolean;
  };
  unread?: boolean;
  group?: any;
  timestamp?: number;
  status?: MessageDeliveryStatus;
  dataMessage?: any;
  sent_to?: Array<string>;
  sent?: boolean;
  calculatingPoW?: boolean;
  serverId?: number;
  serverTimestamp?: number;
  isPublic?: boolean;
  sentSync?: boolean;
  synced?: boolean;
  sync?: boolean;
  snippet?: any;
  direction?: any;
}

/**
 * This function mutates optAttributes
 * @param optAttributes the entry object attributes to set the defaults to.
 */
export const fillMessageAttributesWithDefaults = (
  optAttributes: MessageAttributesOptionals
): MessageAttributes => {
  //FIXME audric to do put the default
  return _.defaults(optAttributes, {
    expireTimer: 0, // disabled
    id: uuidv4(),
  });
};

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
  previews: Array<any>;
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
