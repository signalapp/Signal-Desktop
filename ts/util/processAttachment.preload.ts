// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable } from 'node:stream';

import { createLogger } from '../logging/log.std.ts';
import type { AttachmentDraftType } from '../types/Attachment.std.ts';
import {
  getAttachmentSizeLimit,
  getRenderDetailsForLimit,
  isAttachmentTooLarge,
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
import { ToastType } from '../types/Toast.dom.tsx';
import { TranscodingTargetQuality } from '../types/transcoding.std.ts';
import { isVideoAttachment } from './Attachment.std.ts';
import { strictAssert } from './assert.std.ts';
import { writeNewDraftStream, deleteDraftFile } from './migrations.preload.ts';
import { getMaxVideoDuration } from './getTranscodingOptions.preload.ts';

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
  let plaintextSize = file.size;
  try {
    if (options.disableTranscoding) {
      // Used only in StoryCreator
    } else if (isImageTypeSupported(fileType) || isHeic(fileType, file.name)) {
      attachment = await handleImageAttachment(file, options);
    } else if (isVideoTypeSupported(fileType)) {
      ({ attachment, transcodedStandardSize: plaintextSize } =
        await handleVideoAttachment(file, options));

      const maxVideoDuration = getMaxVideoDuration(
        TranscodingTargetQuality.Standard
      );

      if (
        !attachment.pending &&
        attachment.duration != null &&
        attachment.duration > maxVideoDuration
      ) {
        window.reduxActions.toast.showToast({
          toastType: ToastType.VideoFileDuration,
          parameters: {
            maxDuration: maxVideoDuration,
          },
        });
        await deleteDraftFile(attachment.path);
        return undefined;
      }
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
    isAttachmentTooLarge({
      plaintextSize,
      ciphertextLimit: sizeLimit,
    })
  ) {
    window.reduxActions.toast.showToast({
      toastType: isVideoAttachment(attachment)
        ? ToastType.VideoFileSize
        : ToastType.FileSize,
      parameters: getRenderDetailsForLimit(sizeLimit),
    });
    strictAssert(!attachment.pending, "processed attachment can't be pending");
    await deleteDraftFile(attachment.path);
    return undefined;
  }

  return attachment;
}
