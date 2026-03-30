// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type {
  InMemoryAttachmentDraftType,
  AttachmentDraftType,
} from '../types/Attachment.std.ts';
import { isImageAttachment } from './Attachment.std.ts';
import { getImageDimensions } from '../types/VisualAttachment.dom.ts';
import { IMAGE_PNG } from '../types/MIME.std.ts';
import * as Errors from '../types/errors.std.ts';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from './getLocalAttachmentUrl.std.ts';
import { writeNewDraftData } from './migrations.preload.ts';
import { createLogger } from '../logging/log.std.ts';

const { omit } = lodash;

const logger = createLogger('writeDraftAttachment');

export async function writeDraftAttachment(
  attachment: InMemoryAttachmentDraftType
): Promise<AttachmentDraftType> {
  if (attachment.pending) {
    throw new Error('writeDraftAttachment: Cannot write pending attachment');
  }

  const local = await writeNewDraftData(attachment.data);

  const localScreenshot = attachment.screenshotData
    ? await writeNewDraftData(attachment.screenshotData)
    : undefined;

  let dimensions: { width?: number; height?: number } = {};
  if (isImageAttachment(attachment)) {
    const objectUrl = getLocalAttachmentUrl(local, {
      disposition: AttachmentDisposition.Draft,
    });

    try {
      dimensions = await getImageDimensions({
        objectUrl,
        logger,
      });
    } catch (error) {
      logger.error(
        'writeDraftAttachment: failed to capture image dimensions',
        Errors.toLogFormat(error)
      );
    }
  }

  return {
    ...omit(attachment, ['data', 'screenshotData']),
    ...local,
    screenshot: localScreenshot
      ? {
          ...localScreenshot,

          contentType: IMAGE_PNG,

          // Unused
          width: 0,
          height: 0,
        }
      : undefined,
    pending: false,
    ...dimensions,
  };
}
