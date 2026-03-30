// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import { createLogger } from '../logging/log.std.ts';
import type {
  AttachmentType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment.std.ts';
import {
  getMaximumOutgoingAttachmentSizeInKb,
  getRenderDetailsForLimit,
  KIBIBYTE,
} from '../types/AttachmentSize.std.ts';
import * as Errors from '../types/errors.std.ts';
import { getValue as getRemoteConfigValue } from '../RemoteConfig.dom.ts';
import { fileToBytes } from './fileToBytes.std.ts';
import { handleImageAttachment } from './handleImageAttachment.preload.ts';
import { handleVideoAttachment } from './handleVideoAttachment.preload.ts';
import { isHeic, stringToMIMEType } from '../types/MIME.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from './GoogleChrome.std.ts';
import { getAttachmentCiphertextSize } from './AttachmentCrypto.std.ts';
import { MediaTier } from '../types/AttachmentDownload.std.ts';

const log = createLogger('processAttachment');

export async function processAttachment(
  file: File,
  options: { generateScreenshot: boolean; flags: number | null }
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
