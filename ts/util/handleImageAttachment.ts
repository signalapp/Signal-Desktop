// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';
import { ipcRenderer } from 'electron';
import { v4 as genUuid } from 'uuid';

import { IMAGE_JPEG, MIMEType, isHeic, stringToMIMEType } from '../types/MIME';
import {
  InMemoryAttachmentDraftType,
  canBeTranscoded,
} from '../types/Attachment';
import { imageToBlurHash } from './imageToBlurHash';
import { scaleImageToLevel } from './scaleImageToLevel';

export async function handleImageAttachment(
  file: File
): Promise<InMemoryAttachmentDraftType> {
  let processedFile: File | Blob = file;

  if (isHeic(file.type)) {
    const uuid = genUuid();
    const arrayBuffer = await file.arrayBuffer();

    const convertedFile = await new Promise<File>((resolve, reject) => {
      ipcRenderer.once(`convert-image:${uuid}`, (_, { error, response }) => {
        if (response) {
          resolve(response);
        } else {
          reject(error);
        }
      });
      ipcRenderer.send('convert-image', uuid, arrayBuffer);
    });

    processedFile = new Blob([convertedFile]);
  }

  const { contentType, file: resizedBlob, fileName } = await autoScale({
    contentType: isHeic(file.type) ? IMAGE_JPEG : stringToMIMEType(file.type),
    fileName: file.name,
    file: processedFile,
  });

  const data = await window.Signal.Types.VisualAttachment.blobToArrayBuffer(
    resizedBlob
  );
  const blurHash = await imageToBlurHash(resizedBlob);

  return {
    fileName: fileName || file.name,
    contentType,
    data,
    size: data.byteLength,
    blurHash,
  };
}

export async function autoScale({
  contentType,
  file,
  fileName,
}: {
  contentType: MIMEType;
  file: File | Blob;
  fileName: string;
}): Promise<{
  contentType: MIMEType;
  file: Blob;
  fileName: string;
}> {
  if (!canBeTranscoded({ contentType })) {
    return { contentType, file, fileName };
  }

  const blob = await scaleImageToLevel(file, true);

  const { name } = path.parse(fileName);

  return {
    contentType: IMAGE_JPEG,
    file: blob,
    fileName: `${name}.jpeg`,
  };
}
