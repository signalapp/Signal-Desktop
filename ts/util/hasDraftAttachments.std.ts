// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentDraftType } from '../types/Attachment.std.js';

export function hasDraftAttachments(
  draftAttachments: ReadonlyArray<AttachmentDraftType> | undefined,
  options: { includePending: boolean }
): boolean {
  if (!draftAttachments) {
    return false;
  }

  if (options.includePending) {
    return draftAttachments.length > 0;
  }

  return draftAttachments.some(item => !item.pending);
}
