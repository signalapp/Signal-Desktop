// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment.std.js';
import { deleteDraftFile } from './migrations.preload.js';

export async function deleteDraftAttachment(
  attachment: Pick<AttachmentType, 'screenshotPath' | 'path'>
): Promise<void> {
  if (attachment.screenshotPath) {
    await deleteDraftFile(attachment.screenshotPath);
  }
  if (attachment.path) {
    await deleteDraftFile(attachment.path);
  }
}
