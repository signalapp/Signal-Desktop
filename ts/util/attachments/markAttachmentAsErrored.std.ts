// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../../types/Attachment.std.ts';
import { missingCaseError } from '../missingCaseError.std.ts';

export function markAttachmentAsErrored(
  attachment: AttachmentType,
  reason:
    | 'too-big'
    | 'backfill-terminal-error'
    | 'undownloadable-from-transit-tier'
): AttachmentType {
  const result = { ...attachment, pending: false, error: true };
  switch (reason) {
    case 'too-big':
      result.wasTooBig = true;
      return result;
    case 'backfill-terminal-error':
      result.backfillError = true;
      return result;
    case 'undownloadable-from-transit-tier':
      // Remove transit tier info (if exists) so we never retry a transit tier download
      delete result.cdnKey;
      delete result.cdnNumber;
      delete result.id;
      return result;
    default:
      throw missingCaseError(reason);
  }
}
