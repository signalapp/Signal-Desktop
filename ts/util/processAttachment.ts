// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import type {
  AttachmentType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment';
import {
  getMaximumOutgoingAttachmentSizeInKb,
  getRenderDetailsForLimit,
  KIBIBYTE,
} from '../types/AttachmentSize';
import * as Errors from '../types/errors';
import { getValue as getRemoteConfigValue } from '../RemoteConfig';
import { fileToBytes } from './fileToBytes';
import { handleImageAttachment } from './handleImageAttachment';
import { handleVideoAttachment } from './handleVideoAttachment';
import { isHeic, stringToMIMEType } from '../types/MIME';
import { ToastType } from '../types/Toast';
import { isImageTypeSupported, isVideoTypeSupported } from './GoogleChrome';

export async function processAttachment(
  file: File,
  options?: { generateScreenshot: boolean }
): Promise<InMemoryAttachmentDraftType | void> {
  const fileType = stringToMIMEType(file.type);

  let attachment: InMemoryAttachmentDraftType;
  try {
    if (isImageTypeSupported(fileType) || isHeic(fileType, file.name)) {
      attachment = await handleImageAttachment(file);
    } else if (isVideoTypeSupported(fileType)) {
      attachment = await handleVideoAttachment(file, options);
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

function isAttachmentSizeOkay(attachment: Readonly<AttachmentType>): boolean {
  const limitKb = getMaximumOutgoingAttachmentSizeInKb(getRemoteConfigValue);
  // this needs to be cast properly
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if ((attachment.data.byteLength / KIBIBYTE).toFixed(4) >= limitKb) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.FileSize,
      parameters: getRenderDetailsForLimit(limitKb),
    });
    return false;
  }

  return true;
}
