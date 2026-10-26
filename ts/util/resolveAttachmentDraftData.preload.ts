// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type {
  AttachmentDraftType,
  AttachmentType,
} from '../types/Attachment.std.ts';
import { getPlaintextHashForInMemoryAttachment } from '../AttachmentCrypto.node.ts';
import { readDraftData } from './migrations.preload.ts';
import { migrateDataToFileSystem } from './attachments/migrateDataToFilesystem.std.ts';
import { getExistingAttachmentDataForReuse } from './attachments/deduplicateAttachment.preload.ts';
import { writeNewAttachmentData } from './migrations.preload.ts';

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

  let newScreenshot: AttachmentType | undefined;
  if (attachment.screenshot != null) {
    const screenshotData = await readDraftData(attachment.screenshot);
    const expectedSize =
      attachment.screenshot.size ?? screenshotData.byteLength;
    if (screenshotData.byteLength !== expectedSize) {
      log.error(
        `Screenshot size from disk ${screenshotData.byteLength} did not match attachment size ${expectedSize}`
      );
      return;
    }

    newScreenshot = await migrateDataToFileSystem(
      {
        ...attachment.screenshot,
        size: screenshotData.byteLength,
      },
      screenshotData,
      {
        writeNewAttachmentData,
        getExistingAttachmentDataForReuse,
        getPlaintextHashForInMemoryAttachment,
      }
    );
  }

  return migrateDataToFileSystem(
    {
      ...attachment,
      screenshot: newScreenshot,
    },
    data,
    {
      writeNewAttachmentData,
      getExistingAttachmentDataForReuse,
      getPlaintextHashForInMemoryAttachment,
    }
  );
}
