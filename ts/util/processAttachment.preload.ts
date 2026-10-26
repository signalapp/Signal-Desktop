// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable } from 'node:stream';

import { createLogger } from '../logging/log.std.ts';
import type { AttachmentDraftType } from '../types/Attachment.std.ts';
import {
  getAttachmentSizeLimit,
  getRenderDetailsForLimit,
  isAttachmentTooLargeToSend,
} from '../types/AttachmentSize.std.ts';
import * as Errors from '../types/errors.std.ts';
import { getValue as getRemoteConfigValue } from '../RemoteConfig.dom.ts';
import { handleImageAttachment } from './handleImageAttachment.preload.ts';
import { handleVideoAttachment } from './handleVideoAttachment.preload.ts';
import { isHeic, stringToMIMEType } from '../types/MIME.std.ts';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from './GoogleChrome.std.ts';
import { isVideoAttachment } from './Attachment.std.ts';
import { writeNewDraftStream } from './migrations.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';

const log = createLogger('processAttachment');

export async function processAttachment(
  file: File,
  options: {
    generateScreenshot: boolean;
    flags: number | null;
    clientUuid: string;
    disableTranscoding?: boolean;
  }
): Promise<AttachmentDraftType | undefined> {
  const fileType = stringToMIMEType(file.type);

  let attachment: AttachmentDraftType | undefined;
  try {
    if (options.disableTranscoding) {
      // Used only in StoryCreator
    } else if (isImageTypeSupported(fileType) || isHeic(fileType, file.name)) {
      attachment = await handleImageAttachment(file, options);
    } else if (isVideoTypeSupported(fileType)) {
      attachment = await handleVideoAttachment(file, options);
    }
  } catch (e) {
    log.error(
      `Was unable to generate thumbnail for fileType ${fileType}`,
      Errors.toLogFormat(e)
    );
  }

  if (attachment == null) {
    attachment = {
      ...(await writeNewDraftStream(Readable.from(file.stream()), file.size)),
      clientUuid: options.clientUuid,
      contentType: fileType,
      fileName: file.name,
      pending: false,
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
