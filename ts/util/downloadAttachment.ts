// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import { downloadAttachmentV2 as doDownloadAttachment } from '../textsecure/downloadAttachment';

export async function downloadAttachment(
  attachmentData: AttachmentType
): Promise<AttachmentType | null> {
  let migratedAttachment: AttachmentType;

  const { server } = window.textsecure;
  if (!server) {
    throw new Error('window.textsecure.server is not available!');
  }

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
    downloaded = await doDownloadAttachment(server, migratedAttachment);
  } catch (error) {
    // Attachments on the server expire after 30 days, then start returning 404 or 403
    if (error && (error.code === 404 || error.code === 403)) {
      return null;
    }

    throw error;
  }

  return downloaded;
}
