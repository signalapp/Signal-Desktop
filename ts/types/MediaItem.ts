// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import type { AttachmentType } from './Attachment';
import type { MIMEType } from './MIME';

export type MediaItemMessageType = Pick<
  MessageAttributesType,
  | 'attachments'
  | 'conversationId'
  | 'id'
  | 'received_at'
  | 'received_at_ms'
  | 'sent_at'
>;

export type MediaItemType = {
  attachment: AttachmentType;
  contentType?: MIMEType;
  index: number;
  loop?: boolean;
  message: MediaItemMessageType;
  objectURL?: string;
  thumbnailObjectUrl?: string;
};
