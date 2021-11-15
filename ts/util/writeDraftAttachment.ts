// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import type {
  InMemoryAttachmentDraftType,
  AttachmentDraftType,
} from '../types/Attachment';

export async function writeDraftAttachment(
  attachment: InMemoryAttachmentDraftType
): Promise<AttachmentDraftType> {
  if (attachment.pending) {
    throw new Error('writeDraftAttachment: Cannot write pending attachment');
  }

  const path = await window.Signal.Migrations.writeNewDraftData(
    attachment.data
  );

  const screenshotPath = attachment.screenshotData
    ? await window.Signal.Migrations.writeNewDraftData(
        attachment.screenshotData
      )
    : undefined;

  return {
    ...omit(attachment, ['data', 'screenshotData']),
    path,
    screenshotPath,
    pending: false,
  };
}
