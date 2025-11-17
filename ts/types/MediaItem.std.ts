// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d.ts';
import type { AttachmentForUIType } from './Attachment.std.js';
import type { LinkPreviewForUIType } from './message/LinkPreviews.std.js';
import type { ServiceIdString } from './ServiceId.std.js';

export type MediaItemMessageType = Readonly<{
  id: string;
  type: MessageAttributesType['type'];
  conversationId: string;
  receivedAt: number;
  receivedAtMs: number | undefined;
  sentAt: number;
  source: string | undefined;
  sourceServiceId: ServiceIdString | undefined;
}>;

export type MediaItemType = {
  type: 'media' | 'document';
  attachment: AttachmentForUIType;
  index: number;
  message: MediaItemMessageType;
};

export type LinkPreviewMediaItemType = Readonly<{
  type: 'link';
  preview: LinkPreviewForUIType;
  message: MediaItemMessageType;
}>;

export type GenericMediaItemType = MediaItemType | LinkPreviewMediaItemType;
