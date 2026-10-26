// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { blobToArrayBuffer } from '../types/VisualAttachment.dom.ts';
import type { MIMEType } from '../types/MIME.std.ts';
import { IMAGE_JPEG, isHeic, stringToMIMEType } from '../types/MIME.std.ts';
import type { AttachmentDraftType } from '../types/Attachment.std.ts';
import { canBeTranscoded } from './Attachment.std.ts';
import { imageToBlurHash } from './imageToBlurHash.dom.ts';
import { scaleImageToLevel } from './scaleImageToLevel.preload.ts';
import { writeNewDraftData } from './migrations.preload.ts';

export async function handleImageAttachment(
  file: File,
  { clientUuid }: { clientUuid: string }
): Promise<AttachmentDraftType> {
  let processedFile: File | Blob = file;

  if (isHeic(file.type, file.name)) {
    const bytes = new Uint8Array(await file.arrayBuffer());

    const convertedData = await new Promise<Uint8Array<ArrayBuffer>>(
      (resolve, reject) => {
        ipcRenderer.once(
          `convert-image:${clientUuid}`,
          (_, { error, response }) => {
            if (response) {
              resolve(response);
            } else {
              reject(error);
            }
          }
        );
        ipcRenderer.send('convert-image', clientUuid, bytes);
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
    clientUuid,
    contentType,
    pending: false,
    ...(await writeNewDraftData(new Uint8Array(data))),
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
