// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';

import * as log from '../logging/log';
import type {
  AttachmentDraftType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment';
import { getMaximumAttachmentSize } from '../types/Attachment';
import { AttachmentToastType } from '../types/AttachmentToastType';
import { fileToBytes } from './fileToBytes';
import { handleImageAttachment } from './handleImageAttachment';
import { handleVideoAttachment } from './handleVideoAttachment';
import { isAttachmentSizeOkay } from './isAttachmentSizeOkay';
import { isFileDangerous } from './isFileDangerous';
import { isHeic, isImage, stringToMIMEType } from '../types/MIME';
import { isImageTypeSupported, isVideoTypeSupported } from './GoogleChrome';

export function getPendingAttachment(
  file: File
): AttachmentDraftType | undefined {
  if (!file) {
    return;
  }

  const fileType = stringToMIMEType(file.type);
  const { name: fileName } = path.parse(file.name);

  return {
    contentType: fileType,
    fileName,
    size: file.size,
    path: file.name,
    pending: true,
  };
}

export function preProcessAttachment(
  file: File,
  draftAttachments: Array<AttachmentDraftType>
): AttachmentToastType | undefined {
  if (!file) {
    return;
  }

  if (file.size > getMaximumAttachmentSize()) {
    return AttachmentToastType.ToastFileSize;
  }

  if (isFileDangerous(file.name)) {
    return AttachmentToastType.ToastDangerousFileType;
  }

  if (draftAttachments.length >= 32) {
    return AttachmentToastType.ToastMaxAttachments;
  }

  const haveNonImage = draftAttachments.some(
    (attachment: AttachmentDraftType) => !isImage(attachment.contentType)
  );
  // You can't add another attachment if you already have a non-image staged
  if (haveNonImage) {
    return AttachmentToastType.ToastOneNonImageAtATime;
  }

  const fileType = stringToMIMEType(file.type);

  // You can't add a non-image attachment if you already have attachments staged
  if (!isImage(fileType) && draftAttachments.length > 0) {
    return AttachmentToastType.ToastCannotMixImageAndNonImageAttachments;
  }

  return undefined;
}

export async function processAttachment(
  file: File
): Promise<InMemoryAttachmentDraftType | void> {
  const fileType = stringToMIMEType(file.type);

  let attachment: InMemoryAttachmentDraftType;
  try {
    if (isImageTypeSupported(fileType) || isHeic(fileType, file.name)) {
      attachment = await handleImageAttachment(file);
    } else if (isVideoTypeSupported(fileType)) {
      attachment = await handleVideoAttachment(file);
    } else {
      const data = await fileToBytes(file);
      attachment = {
        contentType: fileType,
        data,
        fileName: file.name,
        path: file.name,
        pending: false,
        size: data.byteLength,
      };
    }
  } catch (e) {
    log.error(
      `Was unable to generate thumbnail for fileType ${fileType}`,
      e && e.stack ? e.stack : e
    );
    const data = await fileToBytes(file);
    attachment = {
      contentType: fileType,
      data,
      fileName: file.name,
      path: file.name,
      pending: false,
      size: data.byteLength,
    };
  }

  try {
    if (isAttachmentSizeOkay(attachment)) {
      return attachment;
    }
  } catch (error) {
    log.error(
      'Error ensuring that image is properly sized:',
      error && error.stack ? error.stack : error
    );

    throw error;
  }
}
