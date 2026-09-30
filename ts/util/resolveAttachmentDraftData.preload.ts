// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type {
  AttachmentDraftType,
  AttachmentType,
} from '../types/Attachment.std.ts';
import { readDraftData } from './migrations.preload.ts';

const log = createLogger('resolveAttachmentDraftData');

export async function resolveAttachmentDraftData(
  attachment?: AttachmentDraftType
): Promise<AttachmentType | undefined> {
  if (!attachment || attachment.pending) {
    return;
  }

  if (!attachment.path) {
    return;
  }

  const data = await readDraftData(attachment);
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
