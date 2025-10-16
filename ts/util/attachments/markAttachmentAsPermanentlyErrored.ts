// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import type { AttachmentType } from '../../types/Attachment.std.js';

const { omit } = lodash;

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
