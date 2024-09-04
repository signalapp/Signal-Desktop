// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../../../../types/Attachment';

export type ItemClickEvent = {
  message: { id: string; sentAt: number };
  attachment: AttachmentType;
  type: 'media' | 'documents';
};
