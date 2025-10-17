// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AttachmentDownloadSource } from '../sql/Interface.std.js';
import { IMAGE_JPEG, IMAGE_PNG } from '../types/MIME.std.js';
import type { AttachmentDownloadJobType } from '../types/AttachmentDownload.std.js';

export function createAttachmentDownloadJob(
  index: number,
  overrides?: Partial<AttachmentDownloadJobType>
): AttachmentDownloadJobType {
  return {
    messageId: `message${index}`,
    attachmentType: 'attachment',
    attachment: {
      digest: `digest${index}`,
      contentType: IMAGE_JPEG,
      size: 128,
    },
    attachmentSignature: `digest${index}`,
    receivedAt: 100 + index,
    ciphertextSize: 1000 + index,
    size: 900 + index,
    contentType: IMAGE_PNG,
    sentAt: 100 + index,
    attempts: index,
    active: index % 2 === 0,
    retryAfter: Date.now() + index,
    lastAttemptTimestamp: Date.now() + index,
    originalSource: AttachmentDownloadSource.STANDARD,
    source: AttachmentDownloadSource.STANDARD,
    ...overrides,
  };
}
