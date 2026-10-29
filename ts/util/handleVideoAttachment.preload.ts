// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable } from 'node:stream';
import { blobToArrayBuffer } from 'blob-util';

import {
  makeVideoScreenshot,
  estimateTranscodedVideoSize,
} from '../types/VisualAttachment.dom.ts';
import { createLogger } from '../logging/log.std.ts';
import { IMAGE_PNG, stringToMIMEType } from '../types/MIME.std.ts';
import type { AttachmentDraftType } from '../types/Attachment.std.ts';
import { TranscodingTargetQuality } from '../types/transcoding.std.ts';
import { DurationInSeconds } from './durations/index.std.ts';
import {
  writeNewDraftData,
  writeNewDraftStream,
} from './migrations.preload.ts';
import { getTranscodingOptions } from './getTranscodingOptions.preload.ts';
import { assertDev } from './assert.std.ts';

const log = createLogger('handleVideoAttachment');

export async function handleVideoAttachment(
  file: File,
  options: {
    generateScreenshot: boolean;
    flags: number | null;
    clientUuid: string;
  }
): Promise<{
  attachment: AttachmentDraftType;
  transcodedStandardSize: number;
}> {
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
      // This is overriden in `enqueueMessageForSend` based on `sendHQImages`
      // boolean.
      transcodingTargetQuality: TranscodingTargetQuality.High,
    };

    let transcodedStandardSize = file.size;

    if (options.generateScreenshot) {
      try {
        const screenshotContentType = IMAGE_PNG;

        const {
          blob: screenshotBlob,
          duration,
          videoBitrateMbps,
          width,
          height,
        } = await makeVideoScreenshot({
          objectUrl,
          contentType: screenshotContentType,
        });

        // Estimate file size to aid size checks in UI or show toast early
        const standard = getTranscodingOptions(
          TranscodingTargetQuality.Standard,
          duration
        );
        const high = getTranscodingOptions(
          TranscodingTargetQuality.High,
          duration
        );

        const sizes = await Promise.all(
          [standard, high].map(config =>
            estimateTranscodedVideoSize({
              url: objectUrl,
              duration,

              targetResolution: config.resolution,
              // Don't raise the bitrate
              targetBitrate: Math.min(
                videoBitrateMbps,
                config.videoBitrateMbps
              ),
            })
          )
        );
        assertDev(
          sizes.length === 2 && sizes[0] != null && sizes[1] != null,
          'Expected two numbers'
        );
        transcodedStandardSize = sizes[0];
        const transcodedHighQualitySize = sizes[1];

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
        attachment.transcodedHighQualitySize = transcodedHighQualitySize;
      } catch (error) {
        log.warn('failed to generate screenshot', error);
      }
    }

    if (options.flags != null) {
      attachment.flags = options.flags;
    }

    return { attachment, transcodedStandardSize };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
