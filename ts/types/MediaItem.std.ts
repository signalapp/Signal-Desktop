// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType, CustomError } from '../model-types.d.ts';
import type { SendStateByConversationId } from '../messages/MessageSendState.std.js';
import type { ReadStatus } from '../messages/MessageReadStatus.std.js';
import type { AttachmentForUIType } from './Attachment.std.js';
import type { LinkPreviewForUIType } from './message/LinkPreviews.std.js';
import type { ServiceIdString } from './ServiceId.std.js';

export type MediaTabType = 'media' | 'audio' | 'links' | 'documents';

export type MediaItemMessageType = Readonly<{
  id: string;
  type: MessageAttributesType['type'];
  conversationId: string;
  receivedAt: number;
  receivedAtMs: number | undefined;
  sentAt: number;
  source: string | undefined;
  sourceServiceId: ServiceIdString | undefined;
  isErased: boolean;
  sendStateByConversationId: SendStateByConversationId | undefined;
  readStatus: ReadStatus | undefined;
  errors: ReadonlyArray<CustomError> | undefined;
}>;

export type MediaItemType = {
  type: 'media' | 'audio' | 'document';
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
