import { defaultsDeep } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { CallNotificationType, PropsForMessageWithConvoProps } from '../state/ducks/conversations';
import { AttachmentTypeWithPath } from '../types/Attachment';

export type MessageModelType = 'incoming' | 'outgoing';
export type MessageDeliveryStatus = 'sending' | 'sent' | 'read' | 'error';

export interface MessageAttributes {
  // the id of the message
  // this can have several uses:
  id: string;
  source: string;
  quote?: any;
  expireTimer: number;
  received_at?: number;
  sent_at?: number;
  preview?: any;
  body?: string;
  expirationStartTimestamp: number;
  read_by: Array<string>; // we actually only care about the length of this. values are not used for anything
  expires_at?: number;
  type: MessageModelType;
  group_update?: MessageGroupUpdate;
  groupInvitation?: any;
  attachments?: any;
  conversationId: string;
  errors?: any;
  flags?: number;
  hasAttachments: 1 | 0;
  hasFileAttachments: 1 | 0;
  hasVisualMediaAttachments: 1 | 0;
  expirationTimerUpdate?: {
    expireTimer: number;
    source: string;
    fromSync?: boolean;
  };
  /**
   * 1 means unread, 0 or anything else is read.
   */
  unread: number;
  group?: any;
  /**
   * timestamp is the sent_at timestamp, which is the envelope.timestamp
   */
  timestamp?: number;
  status?: MessageDeliveryStatus;
  sent_to: Array<string>;
  sent: boolean;

  /**
   * The serverId is the id on the open group server itself.
   * Each message sent to an open group gets a serverId.
   * This is not the id for the server, but the id ON the server.
   *
   * This field is not set for a message not on an opengroup server.
   */
  serverId?: number;
  /**
   * This is the timestamp of that messages as it was saved by the Open group server.
   * We rely on this one to order Open Group messages.
   * This field is not set for a message not on an opengroup server.
   */
  serverTimestamp?: number;
  /**
   * This field is set to true if the message is for a public server.
   * This is useful to make the Badge `Public` Appear on a sent message to a server, even if we did not get
   * the response from the server yet that this message was successfully added.
   */
  isPublic: boolean;

  /**
   * sentSync set to true means we just triggered the sync message for this Private Chat message.
   * We did not yet get the message sent confirmation, it was just added to the Outgoing MessageQueue
   */
  sentSync: boolean;

  /**
   * synced set to true means that this message was successfully sent by our current device to our other devices.
   * It is set to true when the MessageQueue did effectively sent our sync message without errors.
   */
  synced: boolean;
  sync: boolean;

  direction: MessageModelType;

  /**
   * This is used for when a user screenshots or saves an attachment you sent.
   * We display a small message just below the message referenced
   */
  dataExtractionNotification?: DataExtractionNotificationMsg;

  /**
   * For displaying a message to notifying when a request has been accepted.
   */
  messageRequestResponse?: MessageRequestResponseMsg;

  /**
   * This field is used for unsending messages and used in sending unsend message requests.
   */
  messageHash?: string;

  /**
   * This field is used for unsending messages and used in sending unsend message requests.
   */
  isDeleted?: boolean;

  callNotificationType?: CallNotificationType;
}

export interface DataExtractionNotificationMsg {
  type: number; // screenshot or saving event, based on SignalService.DataExtractionNotification.Type
  source: string; // the guy who made a screenshot
  referencedAttachmentTimestamp: number; // the attachment timestamp he screenshot
}

export interface MessageRequestResponseMsg {
  source: string;
  isApproved: boolean;
}

export enum MessageDirection {
  outgoing = 'outgoing',
  incoming = 'incoming',
  any = '%',
}

export type PropsForDataExtractionNotification = DataExtractionNotificationMsg & {
  name: string;
  messageId: string;
  receivedAt?: number;
  isUnread: boolean;
};

export type PropsForMessageRequestResponse = MessageRequestResponseMsg & {
  conversationId?: string;
  name?: string;
  messageId: string;
  receivedAt?: number;
  isUnread: boolean;
  isApproved?: boolean;
  source?: string;
};

export type MessageGroupUpdate = {
  left?: Array<string>;
  joined?: Array<string>;
  kicked?: Array<string>;
  name?: string;
};

export interface MessageAttributesOptionals {
  id?: string;
  source: string;
  quote?: any;
  expireTimer?: number;
  received_at?: number;
  sent_at?: number;
  preview?: any;
  body?: string;
  expirationStartTimestamp?: number;
  read_by?: Array<string>; // we actually only care about the length of this. values are not used for anything
  expires_at?: number;
  type: MessageModelType;
  group_update?: MessageGroupUpdate;
  groupInvitation?: any;
  attachments?: any;
  contact?: any;
  conversationId: string;
  errors?: any;
  flags?: number;
  hasAttachments?: boolean;
  hasFileAttachments?: boolean;
  hasVisualMediaAttachments?: boolean;
  expirationTimerUpdate?: {
    expireTimer: number;
    source: string;
    fromSync?: boolean;
  };
  dataExtractionNotification?: {
    type: number;
    source: string;
    referencedAttachmentTimestamp: number;
  };
  messageRequestResponse?: {
    /** 1 means approved, 0 means unapproved. */
    isApproved?: number;
  };
  unread?: number;
  group?: any;
  timestamp?: number;
  status?: MessageDeliveryStatus;
  sent_to?: Array<string>;
  sent?: boolean;
  serverId?: number;
  serverTimestamp?: number;
  isPublic?: boolean;
  sentSync?: boolean;
  synced?: boolean;
  sync?: boolean;
  direction?: MessageModelType;
  messageHash?: string;
  isDeleted?: boolean;
  callNotificationType?: CallNotificationType;
}

/**
 * This function mutates optAttributes
 * @param optAttributes the entry object attributes to set the defaults to.
 */
export const fillMessageAttributesWithDefaults = (
  optAttributes: MessageAttributesOptionals
): MessageAttributes => {
  const defaulted = defaultsDeep(optAttributes, {
    expireTimer: 0, // disabled
    id: uuidv4(),
    unread: 0, // if nothing is set, this message is considered read
  });
  // this is just to cleanup a bit the db. delivered and delivered_to were removed, so everytime we load a message
  // we make sure to clean those fields in the json.
  // the next commit() will write that to the disk
  if (defaulted.delivered) {
    delete defaulted.delivered;
  }
  if (defaulted.delivered_to) {
    delete defaulted.delivered_to;
  }
  return defaulted;
};

/**
 * Those props are the one generated from a single Message improved by the one by the app itself.
 * Some of the one added comes from the MessageList, some from redux, etc..
 */
export type MessageRenderingProps = PropsForMessageWithConvoProps & {
  disableMenu?: boolean;
  /** Note: this should be formatted for display */
  attachments?: Array<AttachmentTypeWithPath>; // vs Array<PropsForAttachment>;

  // whether or not to allow selecting the message
  multiSelectMode: boolean;
  firstMessageOfSeries: boolean;
  lastMessageOfSeries: boolean;
};
