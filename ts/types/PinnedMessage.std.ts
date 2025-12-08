// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '@signalapp/mock-server/src/types.js';
import type { MessageAttributesType } from '../model-types.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';

export type PinnedMessageId = number & { PinnedMessageId: never };

export type PinnedMessage = Readonly<{
  id: PinnedMessageId;
  conversationId: string;
  messageId: string;
  pinnedAt: number;
  expiresAt: number | null;
}>;

export type PinnedMessageParams = Omit<PinnedMessage, 'id'>;

export type PinnedMessageRenderData = Readonly<{
  pinnedMessage: PinnedMessage;
  sender: ConversationType;
  message: MessageAttributesType;
}>;

export type SendPinMessageType = Readonly<{
  targetAuthorAci: AciString;
  targetSentTimestamp: number;
  pinDurationSeconds: number | null;
}>;

export type SendUnpinMessageType = Readonly<{
  targetAuthorAci: AciString;
  targetSentTimestamp: number;
}>;
