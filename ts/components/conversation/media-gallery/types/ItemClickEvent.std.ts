// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../../../../types/Attachment.std.js';
import type { AttachmentStatusType } from '../../../../hooks/useAttachmentStatus.std.js';

export type ItemClickEvent = {
  message: { id: string; sentAt: number };
  attachment: AttachmentType;
  type: 'media' | 'documents';
  state: AttachmentStatusType['state'];
};
