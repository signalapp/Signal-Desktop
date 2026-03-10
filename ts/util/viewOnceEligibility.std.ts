// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentDraftType } from '../types/Attachment.std.js';
import { isImageAttachment, isVideoAttachment } from './Attachment.std.js';

export function isViewOnceEligible(
  attachments: ReadonlyArray<AttachmentDraftType>,
  hasQuote: boolean
): boolean {
  return Boolean(
    attachments.length === 1 &&
    (isImageAttachment(attachments[0]) || isVideoAttachment(attachments[0])) &&
    !hasQuote
  );
}
