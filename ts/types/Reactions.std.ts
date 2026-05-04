// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Emoji } from '../axo/emoji.std.ts';
import type { AciString } from './ServiceId.std.ts';

export type ReactionType = Readonly<{
  conversationId: string;
  emoji: Emoji.Variant;
  fromId: string;
  messageId: string;
  messageReceivedAt: number;
  targetAuthorAci: AciString;
  targetTimestamp: number;
  timestamp: number;
}>;

export enum ReactionReadStatus {
  Unread = 'Unread',
  Read = 'Read',
}
