// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable } from 'node:stream';
import { blobToArrayBuffer } from 'blob-util';

import { makeVideoScreenshot } from '../types/VisualAttachment.dom.ts';
import { createLogger } from '../logging/log.std.ts';
import { IMAGE_PNG, stringToMIMEType } from '../types/MIME.std.ts';
import type { AttachmentDraftType } from '../types/Attachment.std.ts';
import { TranscodingTargetQuality } from '../types/transcoding.std.ts';
import { DurationInSeconds } from './durations/index.std.ts';
import {
  writeNewDraftData,
  writeNewDraftStream,
} from './migrations.preload.ts';

const log = createLogger('handleVideoAttachment');

export async function handleVideoAttachment(
  file: File,
  options: {
    generateScreenshot: boolean;
    flags: number | null;
    clientUuid: string;
  }
): Promise<AttachmentDraftType> {
  const objectUrl = URL.createObjectURL(file);
  if (!objectUrl) {
    throw new Error('Failed to create object url for video!');
  }
  try {
    const attachment: AttachmentDraftType = {
      ...(await writeNewDraftStream(Readable.from(file.stream()), file.size)),
      contentType: stringToMIMEType(file.type),
      clientUuid: options.clientUuid,
      // We strip fileNames from visual attachments
      fileName: undefined,
      pending: false,
      transcodingTargetQuality: TranscodingTargetQuality.High,
    };

    if (options.generateScreenshot) {
      try {
        const screenshotContentType = IMAGE_PNG;

        const {
          blob: screenshotBlob,
          duration,
          width,
          height,
        } = await makeVideoScreenshot({
          objectUrl,
          contentType: screenshotContentType,
        });
        attachment.duration =
          duration == null
            ? undefined
            : DurationInSeconds.fromSeconds(duration);
        attachment.screenshot = {
          ...(await writeNewDraftData(
            new Uint8Array(await blobToArrayBuffer(screenshotBlob))
          )),
          contentType: screenshotContentType,
        };
        attachment.width = width;
        attachment.height = height;
      } catch (error) {
        log.warn('failed to generate screenshot', error);
      }
    }

    if (options.flags != null) {
      attachment.flags = options.flags;
    }

    return attachment;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
