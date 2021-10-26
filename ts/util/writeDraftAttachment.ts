// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import type { AttachmentType } from '../types/Attachment';

export async function writeDraftAttachment(
  attachment: AttachmentType
): Promise<AttachmentType> {
  if (attachment.pending) {
    throw new Error('writeDraftAttachment: Cannot write pending attachment');
  }

  const result: AttachmentType = {
    ...omit(attachment, ['data', 'screenshotData']),
    pending: false,
  };
  if (attachment.data) {
    result.path = await window.Signal.Migrations.writeNewDraftData(
      attachment.data
    );
  }
  if (attachment.screenshotData) {
    result.screenshotPath = await window.Signal.Migrations.writeNewDraftData(
      attachment.screenshotData
    );
  }
  return result;
}
