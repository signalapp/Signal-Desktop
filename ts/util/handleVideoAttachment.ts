// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';

import * as log from '../logging/log';
import { makeVideoScreenshot } from '../types/VisualAttachment';
import { IMAGE_PNG, stringToMIMEType } from '../types/MIME';
import type { InMemoryAttachmentDraftType } from '../types/Attachment';
import { fileToBytes } from './fileToBytes';

export async function handleVideoAttachment(
  file: Readonly<File>
): Promise<InMemoryAttachmentDraftType> {
  const objectUrl = URL.createObjectURL(file);
  if (!objectUrl) {
    throw new Error('Failed to create object url for video!');
  }
  try {
    const screenshotContentType = IMAGE_PNG;
    const screenshotBlob = await makeVideoScreenshot({
      objectUrl,
      contentType: screenshotContentType,
      logger: log,
    });
    const screenshotData = await blobToArrayBuffer(screenshotBlob);
    const data = await fileToBytes(file);

    return {
      contentType: stringToMIMEType(file.type),
      data,
      fileName: file.name,
      path: file.name,
      pending: false,
      screenshotContentType,
      screenshotData: new Uint8Array(screenshotData),
      screenshotSize: screenshotData.byteLength,
      size: data.byteLength,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
