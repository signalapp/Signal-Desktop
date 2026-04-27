// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import { createLogger } from '../logging/log.std.ts';
import type { InMemoryAttachmentDraftType } from '../types/Attachment.std.ts';
import {
  getAttachmentSizeLimit,
  getRenderDetailsForLimit,
  isAttachmentTooLargeToSend,
} from '../types/AttachmentSize.std.ts';
import * as Errors from '../types/errors.std.ts';
import { getValue as getRemoteConfigValue } from '../RemoteConfig.dom.ts';
import { fileToBytes } from './fileToBytes.std.ts';
import { handleImageAttachment } from './handleImageAttachment.preload.ts';
import { handleVideoAttachment } from './handleVideoAttachment.preload.ts';
import { isHeic, stringToMIMEType } from '../types/MIME.std.ts';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from './GoogleChrome.std.ts';
import { isVideoAttachment } from './Attachment.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';

const log = createLogger('processAttachment');

export async function processAttachment(
  file: File,
  options: { generateScreenshot: boolean; flags: number | null }
): Promise<InMemoryAttachmentDraftType | undefined> {
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

  const sizeLimit = getAttachmentSizeLimit({
    contentType: fileType,
    getRemoteConfigValue,
  });

  if (
    isAttachmentTooLargeToSend({
      plaintextSize: attachment.size,
      limit: sizeLimit,
    })
  ) {
    window.reduxActions.toast.showToast({
      toastType: isVideoAttachment(attachment)
        ? ToastType.VideoFileSize
        : ToastType.FileSize,
      parameters: getRenderDetailsForLimit(sizeLimit),
    });
    return undefined;
  }

  return attachment;
}
