import { DefaultTheme } from 'styled-components';
import _ from 'underscore';
import { v4 as uuidv4 } from 'uuid';
import { QuotedAttachmentType } from '../components/conversation/Quote';
import { PropsForMessage } from '../state/ducks/conversations';
import { AttachmentType, AttachmentTypeWithPath } from '../types/Attachment';
import { Contact } from '../types/Contact';
import { ConversationTypeEnum } from './conversation';

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
  destination?: string;
  preview?: any;
  body?: string;
  expirationStartTimestamp: number;
  read_by: Array<string>;
  decrypted_at: number;
  expires_at?: number;
  recipients: Array<string>;
  type: MessageModelType;
  group_update?: any;
  groupInvitation?: any;
  attachments?: any;
  conversationId: string;
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
  dataMessage: any;
  sent_to: any;
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

  /**
   * This field is used for search only
   */
  snippet?: any;
  direction: any;

  /**
   * This is used for when a user screenshots or saves an attachment you sent.
   * We display a small message just below the message referenced
   */
  dataExtractionNotification?: DataExtractionNotificationMsg;
}

export interface DataExtractionNotificationMsg {
  type: number; // screenshot or saving event, based on SignalService.DataExtractionNotification.Type
  source: string; // the guy who made a screenshot
  referencedAttachmentTimestamp: number; // the attachment timestamp he screenshot
}

export type PropsForDataExtractionNotification = DataExtractionNotificationMsg & {
  name: string;
  messageId: string;
};

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
  decrypted_at?: number;
  expires_at?: number;
  recipients?: Array<string>;
  type: MessageModelType;
  group_update?: any;
  groupInvitation?: any;
  attachments?: any;
  contact?: any;
  conversationId: string;
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
  };
  dataExtractionNotification?: {
    type: number;
    source: string;
    referencedAttachmentTimestamp: number;
  };
  unread?: number;
  group?: any;
  timestamp?: number;
  status?: MessageDeliveryStatus;
  dataMessage?: any;
  sent_to?: Array<string>;
  sent?: boolean;
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
  const defaulted = _.defaults(optAttributes, {
    expireTimer: 0, // disabled
    id: uuidv4(),
    schemaVersion: window.Signal.Types.Message.CURRENT_SCHEMA_VERSION,
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

export type QuoteClickOptions = {
  quoteAuthor: string;
  quoteId: number;
  referencedMessageNotFound: boolean;
};

/**
 * Those props are the one generated from a single Message improved by the one by the app itself.
 * Some of the one added comes from the MessageList, some from redux, etc..
 */
export type MessageRenderingProps = PropsForMessage & {
  disableMenu?: boolean;
  collapseMetadata?: boolean;
  /** Note: this should be formatted for display */
  attachments?: Array<AttachmentTypeWithPath>; // vs Array<PropsForAttachment>;

  // whether or not to allow selecting the message
  multiSelectMode: boolean;
  firstMessageOfSeries: boolean;
  onQuoteClick?: (options: QuoteClickOptions) => Promise<void>;

  playableMessageIndex?: number;
  nextMessageToPlay?: number;
  playNextMessage?: (value: number) => void;
};
