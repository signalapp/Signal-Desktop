// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';

import { type AttachmentType } from '../../types/Attachment';

export function markAttachmentAsPermanentlyErrored(
  attachment: AttachmentType,
  { backfillError }: { backfillError: boolean }
): AttachmentType {
  return {
    ...omit(attachment, ['key', 'id']),
    pending: false,
    error: true,
    backfillError,
  };
}
