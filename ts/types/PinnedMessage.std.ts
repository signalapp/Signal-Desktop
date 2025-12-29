// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '@signalapp/mock-server/src/types.js';
import type { ReadonlyMessageAttributesType } from '../model-types.js';

export type PinnedMessageId = number & { PinnedMessageId: never };

export type PinnedMessage = Readonly<{
  id: PinnedMessageId;
  conversationId: string;
  messageId: string;
  pinnedAt: number;
  expiresAt: number | null;
}>;

export type PinnedMessageParams = Omit<PinnedMessage, 'id'>;

export type PinnedMessagePreloadData = Readonly<{
  pinnedMessage: PinnedMessage;
  message: ReadonlyMessageAttributesType;
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
