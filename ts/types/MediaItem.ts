// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import type { AttachmentType } from './Attachment';
import type { MIMEType } from './MIME';

export type MediaItemMessageType = Pick<
  ReadonlyMessageAttributesType,
  'attachments' | 'conversationId' | 'id'
> & {
  receivedAt: number;
  receivedAtMs?: number;
  sentAt: number;
};

export type MediaItemType = {
  attachment: AttachmentType;
  contentType?: MIMEType;
  index: number;
  loop?: boolean;
  message: MediaItemMessageType;
  objectURL?: string;
  incrementalObjectUrl?: string;
  thumbnailObjectUrl?: string;
  size?: number;
};
