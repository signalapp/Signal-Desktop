import { Attachment } from './Attachment';
import { Contact } from './Contact';
import { IndexableBoolean, IndexablePresence } from './IndexedDB';

export type Message = UserMessage;
export type UserMessage = IncomingMessage;

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
    expireTimer?: number;
    flags?: number;
    source?: string;
    sourceDevice?: number;
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    MessageSchemaVersion6 &
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

type MessageSchemaVersion5 = Partial<
  Readonly<{
    hasAttachments: IndexableBoolean;
    hasVisualMediaAttachments: IndexablePresence;
    hasFileAttachments: IndexablePresence;
  }>
>;

type MessageSchemaVersion6 = Partial<
  Readonly<{
    contact: Array<Contact>;
  }>
>;

export const isUserMessage = (message: Message): message is UserMessage =>
  message.type === 'incoming';

export const hasExpiration = (message: Message): boolean => {
  if (!isUserMessage(message)) {
    return false;
  }

  const { expireTimer } = message;

  return typeof expireTimer === 'number' && expireTimer > 0;
};

export type LokiProfile = {
  displayName: string;
  avatarPointer: string;
  profileKey: Uint8Array;
};
