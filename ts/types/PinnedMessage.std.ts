// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { AciString } from './ServiceId.std.js';

export type PinnedMessageId = number & { PinnedMessageId: never };

export type PinnedMessage = Readonly<{
  id: PinnedMessageId;
  conversationId: string;
  messageId: string;
  messageSentAt: number;
  messageSenderAci: AciString;
  pinnedByAci: AciString;
  pinnedAt: number;
  expiresAt: number | null;
}>;

export type PinnedMessageParams = Omit<PinnedMessage, 'id'>;

export type PinnedMessageRenderData = Readonly<{
  pinnedMessage: PinnedMessage;
  sender: ConversationType;
  message: MessageAttributesType;
}>;
