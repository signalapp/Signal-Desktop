// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import { v4 as genUuid } from 'uuid';

import { blobToArrayBuffer } from '../types/VisualAttachment.dom.js';
import type { MIMEType } from '../types/MIME.std.js';
import { IMAGE_JPEG, isHeic, stringToMIMEType } from '../types/MIME.std.js';
import type { InMemoryAttachmentDraftType } from '../types/Attachment.std.js';
import { canBeTranscoded } from './Attachment.std.js';
import { imageToBlurHash } from './imageToBlurHash.dom.js';
import { scaleImageToLevel } from './scaleImageToLevel.preload.js';

export async function handleImageAttachment(
  file: File
): Promise<InMemoryAttachmentDraftType> {
  let processedFile: File | Blob = file;

  if (isHeic(file.type, file.name)) {
    const uuid = genUuid();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const convertedData = await new Promise<Uint8Array<ArrayBuffer>>(
      (resolve, reject) => {
        ipcRenderer.once(`convert-image:${uuid}`, (_, { error, response }) => {
          if (response) {
            resolve(response);
          } else {
            reject(error);
          }
        });
        ipcRenderer.send('convert-image', uuid, bytes);
      }
    );

    processedFile = new Blob([convertedData]);
  }

  const { contentType, file: resizedBlob } = await autoScale({
    contentType: isHeic(file.type, file.name)
      ? IMAGE_JPEG
      : stringToMIMEType(file.type),
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
    // We strip fileNames from visual attachments
    fileName: undefined,
    path: file.name,
    pending: false,
    size: data.byteLength,
  };
}

export async function autoScale({
  contentType,
  file,
  highQuality,
}: {
  contentType: MIMEType;
  file: File | Blob;
  highQuality: boolean;
}): Promise<{
  contentType: MIMEType;
  file: Blob;
}> {
  if (!canBeTranscoded({ contentType })) {
    return { contentType, file };
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
    };
  }

  return {
    contentType: IMAGE_JPEG,
    file: blob,
  };
}
