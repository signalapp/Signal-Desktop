// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from './Attachment';
import type { MIMEType } from './MIME';

export type MessageAttributesType = {
  attachments: Array<AttachmentType>;
  conversationId: string;
  id: string;
  // eslint-disable-next-line camelcase
  received_at: number;
  // eslint-disable-next-line camelcase
  received_at_ms: number;
  // eslint-disable-next-line camelcase
  sent_at: number;
};

export type MediaItemType = {
  attachment: AttachmentType;
  contentType?: MIMEType;
  index: number;
  loop?: boolean;
  message: MessageAttributesType;
  objectURL?: string;
  thumbnailObjectUrl?: string;
};
