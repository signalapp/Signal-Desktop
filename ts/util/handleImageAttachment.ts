// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';
import { ipcRenderer } from 'electron';
import { v4 as genUuid } from 'uuid';

import { blobToArrayBuffer } from '../types/VisualAttachment';
import type { MIMEType } from '../types/MIME';
import { IMAGE_JPEG, isHeic, stringToMIMEType } from '../types/MIME';
import type { InMemoryAttachmentDraftType } from '../types/Attachment';
import { canBeTranscoded } from '../types/Attachment';
import { imageToBlurHash } from './imageToBlurHash';
import { scaleImageToLevel } from './scaleImageToLevel';

export async function handleImageAttachment(
  file: File
): Promise<InMemoryAttachmentDraftType> {
  let processedFile: File | Blob = file;

  if (isHeic(file.type, file.name)) {
    const uuid = genUuid();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const convertedData = await new Promise<Uint8Array>((resolve, reject) => {
      ipcRenderer.once(`convert-image:${uuid}`, (_, { error, response }) => {
        if (response) {
          resolve(response);
        } else {
          reject(error);
        }
      });
      ipcRenderer.send('convert-image', uuid, bytes);
    });

    processedFile = new Blob([convertedData]);
  }

  const {
    contentType,
    file: resizedBlob,
    fileName,
  } = await autoScale({
    contentType: isHeic(file.type, file.name)
      ? IMAGE_JPEG
      : stringToMIMEType(file.type),
    fileName: file.name,
    file: processedFile,
    // We always store draft attachments as HQ
    highQuality: true,
  });

  const data = await blobToArrayBuffer(resizedBlob);
  const blurHash = await imageToBlurHash(resizedBlob);

  return {
    blurHash,
    clientUuid: genUuid(),
    contentType,
    data: new Uint8Array(data),
    fileName: fileName || file.name,
    path: file.name,
    pending: false,
    size: data.byteLength,
  };
}

export async function autoScale({
  contentType,
  file,
  fileName,
  highQuality,
}: {
  contentType: MIMEType;
  file: File | Blob;
  fileName: string;
  highQuality: boolean;
}): Promise<{
  contentType: MIMEType;
  file: Blob;
  fileName: string;
}> {
  if (!canBeTranscoded({ contentType })) {
    return { contentType, file, fileName };
  }

  const { blob, contentType: newContentType } = await scaleImageToLevel({
    fileOrBlobOrURL: file,
    contentType,
    size: file.size,
    highQuality,
  });

  if (newContentType !== IMAGE_JPEG) {
    return {
      contentType,
      file: blob,
      fileName,
    };
  }

  const { name } = path.parse(fileName);

  return {
    contentType: IMAGE_JPEG,
    file: blob,
    fileName: `${name}.jpg`,
  };
}
