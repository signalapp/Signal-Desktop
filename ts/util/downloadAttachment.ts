// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  AttachmentType,
  DownloadedAttachmentType,
} from '../types/Attachment';
import { downloadAttachment as doDownloadAttachment } from '../textsecure/downloadAttachment';

export async function downloadAttachment(
  attachmentData: AttachmentType
): Promise<DownloadedAttachmentType | null> {
  let migratedAttachment: AttachmentType;

  const { id: legacyId } = attachmentData;
  if (legacyId === undefined) {
    migratedAttachment = attachmentData;
  } else {
    migratedAttachment = {
      ...attachmentData,
      cdnId: String(legacyId),
    };
  }

  let downloaded;
  try {
    downloaded = await doDownloadAttachment(
      window.textsecure.server,
      migratedAttachment
    );
  } catch (error) {
    // Attachments on the server expire after 30 days, then start returning 404
    if (error && error.code === 404) {
      return null;
    }

    throw error;
  }

  return downloaded;
}
