// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import type { AttachmentType } from './Attachment';
import type { EmbeddedContactType } from './EmbeddedContact';
import type { IndexableBoolean, IndexablePresence } from './IndexedDB';

export type Message = (
  | UserMessage
  | VerifiedChangeMessage
  | MessageHistoryUnsyncedMessage
  | ProfileChangeNotificationMessage
) & { deletedForEveryone?: boolean };
export type UserMessage = IncomingMessage | OutgoingMessage;

export type IncomingMessage = Readonly<
  {
    type: 'incoming';
    // Required
    attachments: Array<AttachmentType>;
    id: string;
    received_at: number;

    // Optional
    body?: string;
    decrypted_at?: number;
    errors?: Array<Error>;
    expireTimer?: number;
    messageTimer?: number; // deprecated
    isViewOnce?: number;
    flags?: number;
    source?: string;
    sourceDevice?: number;
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    MessageSchemaVersion6 &
    ExpirationTimerUpdate
>;

export type OutgoingMessage = Readonly<
  {
    type: 'outgoing';

    // Required
    attachments: Array<AttachmentType>;
    expirationStartTimestamp: number;
    id: string;
    received_at: number;

    // Optional
    body?: string;
    expireTimer?: number;
    messageTimer?: number; // deprecated
    isViewOnce?: number;
    synced: boolean;
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    ExpirationTimerUpdate
>;

export type VerifiedChangeMessage = Readonly<
  {
    type: 'verified-change';
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    ExpirationTimerUpdate
>;

export type MessageHistoryUnsyncedMessage = Readonly<
  {
    type: 'message-history-unsynced';
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    ExpirationTimerUpdate
>;

export type ProfileChangeNotificationMessage = Readonly<
  {
    type: 'profile-change';
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
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
    contact: Array<EmbeddedContactType>;
  }>
>;

export const isUserMessage = (message: Message): message is UserMessage =>
  message.type === 'incoming' || message.type === 'outgoing';

export const hasExpiration = (message: Message): boolean => {
  if (!isUserMessage(message)) {
    return false;
  }

  const { expireTimer } = message;

  return typeof expireTimer === 'number' && expireTimer > 0;
};
