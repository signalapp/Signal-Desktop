// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentForUIType } from './Attachment.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';

export type MediaItemMessageType = Readonly<{
  id: string;
  type: MessageAttributesType['type'];
  conversationId: string;
  receivedAt: number;
  receivedAtMs?: number;
  sentAt: number;
}>;

export type MediaItemType = {
  attachment: AttachmentForUIType;
  index: number;
  message: MediaItemMessageType;
};
