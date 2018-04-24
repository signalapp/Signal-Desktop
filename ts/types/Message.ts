/**
 * @prettier
 */
import { Attachment } from './Attachment';
import { IndexableBoolean } from './IndexedDB';

export type Message = UserMessage | VerifiedChangeMessage;
export type UserMessage = IncomingMessage | OutgoingMessage;

export type IncomingMessage = Readonly<
  {
    type: 'incoming';
    // Required
    attachments: Array<Attachment>;
    id: string;
    received_at: number;

    // Optional
    body?: string;
    decrypted_at?: number;
    errors?: Array<any>;
    flags?: number;
    source?: string;
    sourceDevice?: number;
  } & SharedMessageProperties &
    MessageSchemaVersion4 &
    ExpirationTimerUpdate
>;

export type OutgoingMessage = Readonly<
  {
    type: 'outgoing';

    // Required
    attachments: Array<Attachment>;
    delivered: number;
    delivered_to: Array<string>;
    destination: string; // PhoneNumber
    expirationStartTimestamp: number;
    id: string;
    received_at: number;
    sent: boolean;
    sent_to: Array<string>; // Array<PhoneNumber>

    // Optional
    body?: string;
    expires_at?: number;
    expireTimer?: number;
    recipients?: Array<string>; // Array<PhoneNumber>
    synced: boolean;
  } & SharedMessageProperties &
    MessageSchemaVersion4 &
    ExpirationTimerUpdate
>;

export type VerifiedChangeMessage = Readonly<
  {
    type: 'verified-change';
  } & SharedMessageProperties &
    MessageSchemaVersion4 &
    ExpirationTimerUpdate
>;

type SharedMessageProperties = Readonly<{
  conversationId: string;
  sent_at: number;
  timestamp: number;
}>;

type ExpirationTimerUpdate = Partial<
  Readonly<{
    expirationTimerUpdate: Readonly<{
      expireTimer: number;
      fromSync: boolean;
      source: string; // PhoneNumber
    }>;
  }>
>;

type MessageSchemaVersion4 = Partial<
  Readonly<{
    hasAttachments: IndexableBoolean;
    hasVisualMediaAttachments: IndexableBoolean;
    hasFileAttachments: IndexableBoolean;
  }>
>;
