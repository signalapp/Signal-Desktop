// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DurationInSeconds } from '../util/durations/index.std.js';
import type { AttachmentType } from './Attachment.std.js';
import type { EmbeddedContactType } from './EmbeddedContact.std.js';

export function getMentionsRegex(): RegExp {
  return /\uFFFC/g;
}

export type Message = (
  | VerifiedChangeMessage
  | ProfileChangeNotificationMessage
) & { deletedForEveryone?: boolean };

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
    expireTimer?: DurationInSeconds;
    messageTimer?: number; // deprecated
    isViewOnce?: number;
    flags?: number;
    source?: string;
    sourceDevice?: number;
  } & SharedMessageProperties &
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
    expireTimer?: DurationInSeconds;
    messageTimer?: number; // deprecated
    isViewOnce?: number;
    synced: boolean;
  } & SharedMessageProperties &
    ExpirationTimerUpdate
>;

export type VerifiedChangeMessage = Readonly<
  {
    type: 'verified-change';
  } & SharedMessageProperties &
    ExpirationTimerUpdate
>;

export type ProfileChangeNotificationMessage = Readonly<
  {
    type: 'profile-change';
  } & SharedMessageProperties &
    ExpirationTimerUpdate
>;

export type SharedMessageProperties = Readonly<{
  conversationId: string;
  sent_at: number;
  timestamp: number;
}>;

export type ExpirationTimerUpdate = Partial<
  Readonly<{
    expirationTimerUpdate: Readonly<{
      expireTimer: DurationInSeconds;
      fromSync: boolean;
      source: string; // PhoneNumber
    }>;
  }>
>;

export type MessageSchemaVersion6 = Partial<
  Readonly<{
    contact: Array<EmbeddedContactType>;
  }>
>;
