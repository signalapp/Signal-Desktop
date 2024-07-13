// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import type { AttachmentType } from '../types/Attachment';

export async function resolveAttachmentDraftData(
  attachment?: AttachmentType
): Promise<AttachmentType | undefined> {
  if (!attachment || attachment.pending) {
    return;
  }

  if (!attachment.path) {
    return;
  }

  const data = await window.Signal.Migrations.readDraftData(attachment);
  if (data.byteLength !== attachment.size) {
    log.error(
      `Attachment size from disk ${data.byteLength} did not match attachment size ${attachment.size}`
    );
    return;
  }

  return {
    ...attachment,
    data,
  };
}
