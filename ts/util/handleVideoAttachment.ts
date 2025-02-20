// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';
import { v4 as generateUuid } from 'uuid';

import { makeVideoScreenshot } from '../types/VisualAttachment';
import { IMAGE_PNG, stringToMIMEType } from '../types/MIME';
import type { InMemoryAttachmentDraftType } from '../types/Attachment';
import { fileToBytes } from './fileToBytes';

export async function handleVideoAttachment(
  file: File,
  options?: { generateScreenshot: boolean; flags: number | null }
): Promise<InMemoryAttachmentDraftType> {
  const objectUrl = URL.createObjectURL(file);
  if (!objectUrl) {
    throw new Error('Failed to create object url for video!');
  }
  try {
    const data = await fileToBytes(file);
    const attachment: InMemoryAttachmentDraftType = {
      contentType: stringToMIMEType(file.type),
      clientUuid: generateUuid(),
      data,
      fileName: file.name,
      path: file.name,
      pending: false,
      size: data.byteLength,
    };

    if (options?.generateScreenshot) {
      const screenshotContentType = IMAGE_PNG;

      const screenshotBlob = await makeVideoScreenshot({
        objectUrl,
        contentType: screenshotContentType,
      });
      attachment.screenshotData = new Uint8Array(
        await blobToArrayBuffer(screenshotBlob)
      );
      attachment.screenshotContentType = screenshotContentType;
    }

    if (options?.flags != null) {
      attachment.flags = options.flags;
    }

    return attachment;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
