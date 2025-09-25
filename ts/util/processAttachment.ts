// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import { createLogger } from '../logging/log.js';
import type {
  AttachmentType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment.js';
import {
  getMaximumOutgoingAttachmentSizeInKb,
  getRenderDetailsForLimit,
  KIBIBYTE,
} from '../types/AttachmentSize.js';
import * as Errors from '../types/errors.js';
import { getValue as getRemoteConfigValue } from '../RemoteConfig.js';
import { fileToBytes } from './fileToBytes.js';
import { handleImageAttachment } from './handleImageAttachment.js';
import { handleVideoAttachment } from './handleVideoAttachment.js';
import { isHeic, stringToMIMEType } from '../types/MIME.js';
import { ToastType } from '../types/Toast.js';
import { isImageTypeSupported, isVideoTypeSupported } from './GoogleChrome.js';
import { getAttachmentCiphertextSize } from './AttachmentCrypto.js';
import { MediaTier } from '../types/AttachmentDownload.js';

const log = createLogger('processAttachment');

export async function processAttachment(
  file: File,
  options?: { generateScreenshot: boolean; flags: number | null }
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
        clientUuid: generateUuid(),
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
      clientUuid: generateUuid(),
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
  const limitBytes =
    getMaximumOutgoingAttachmentSizeInKb(getRemoteConfigValue) * KIBIBYTE;

  const paddedAndEncryptedSize = getAttachmentCiphertextSize({
    unpaddedPlaintextSize: attachment.size,
    mediaTier: MediaTier.STANDARD,
  });
  if (paddedAndEncryptedSize > limitBytes) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.FileSize,
      parameters: getRenderDetailsForLimit(limitKb),
    });
    return false;
  }

  return true;
}
