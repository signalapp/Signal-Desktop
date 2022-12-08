// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import type {
  AttachmentType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment';
import { getMaximumAttachmentSize } from './attachments';
import * as Errors from '../types/errors';
import { fileToBytes } from './fileToBytes';
import { handleImageAttachment } from './handleImageAttachment';
import { handleVideoAttachment } from './handleVideoAttachment';
import { isHeic, stringToMIMEType } from '../types/MIME';
import { isImageTypeSupported, isVideoTypeSupported } from './GoogleChrome';
import { showToast } from './showToast';
import { ToastFileSize } from '../components/ToastFileSize';

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
      Errors.toLogFormat(e)
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
      Errors.toLogFormat(error)
    );

    throw error;
  }
}

export function getRenderDetailsForLimit(limitKb: number): {
  limit: string;
  units: string;
} {
  const units = ['kB', 'MB', 'GB'];
  let u = -1;
  let limit = limitKb * 1000;
  do {
    limit /= 1000;
    u += 1;
  } while (limit >= 1000 && u < units.length - 1);

  return {
    limit: limit.toFixed(0),
    units: units[u],
  };
}

function isAttachmentSizeOkay(attachment: Readonly<AttachmentType>): boolean {
  const limitKb = getMaximumAttachmentSize();
  // this needs to be cast properly
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if ((attachment.data.byteLength / 1024).toFixed(4) >= limitKb) {
    showToast(ToastFileSize, getRenderDetailsForLimit(limitKb));
    return false;
  }

  return true;
}
