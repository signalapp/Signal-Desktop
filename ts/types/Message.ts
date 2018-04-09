import { Attachment } from './Attachment';


export type Message = IncomingMessage | OutgoingMessage;

export type IncomingMessage = {
  type: 'incoming';
  attachments: Array<Attachment>;
  body?: string;
  conversationId: string;
  decrypted_at?: number;
  errors?: Array<any>;
  flags?: number;
  id: string;
  received_at: number;
  sent_at: number;
  source?: string;
  sourceDevice?: number;
  timestamp: number;
} & Message4

export type OutgoingMessage = {
  type: 'outgoing';
  attachments: Array<Attachment>;
  body?: string;
  conversationId: string;
  delivered: number;
  delivered_to: Array<string>;
  destination: string; // PhoneNumber
  expirationStartTimestamp: number;
  expires_at?: number;
  expireTimer?: number;
  id: string;
  received_at: number;
  recipients?: Array<string>; // Array<PhoneNumber>
  sent: boolean;
  sent_at: number;
  sent_to: Array<string>; // Array<PhoneNumber>
  synced: boolean;
  timestamp: number;
} & Message4

interface Message4 {
  numAttachments?: number;
  numVisualMediaAttachments?: number;
  numFileAttachments?: number;
}
