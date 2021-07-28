// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';
import { MIMEType, IMAGE_JPEG } from '../types/MIME';
import {
  InMemoryAttachmentDraftType,
  canBeTranscoded,
} from '../types/Attachment';
import { imageToBlurHash } from './imageToBlurHash';
import { scaleImageToLevel } from './scaleImageToLevel';

export async function handleImageAttachment(
  file: File
): Promise<InMemoryAttachmentDraftType> {
  const blurHash = await imageToBlurHash(file);

  const { contentType, file: resizedBlob, fileName } = await autoScale({
    contentType: file.type as MIMEType,
    fileName: file.name,
    file,
  });
  const data = await window.Signal.Types.VisualAttachment.blobToArrayBuffer(
    resizedBlob
  );
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
