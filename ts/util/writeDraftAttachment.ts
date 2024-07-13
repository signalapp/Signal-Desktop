// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import type {
  InMemoryAttachmentDraftType,
  AttachmentDraftType,
} from '../types/Attachment';
import { isImageAttachment } from '../types/Attachment';
import { getImageDimensions } from '../types/VisualAttachment';
import { IMAGE_PNG } from '../types/MIME';
import * as Errors from '../types/errors';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from './getLocalAttachmentUrl';
import * as logger from '../logging/log';

export async function writeDraftAttachment(
  attachment: InMemoryAttachmentDraftType
): Promise<AttachmentDraftType> {
  if (attachment.pending) {
    throw new Error('writeDraftAttachment: Cannot write pending attachment');
  }

  const local = await window.Signal.Migrations.writeNewDraftData(
    attachment.data
  );

  const localScreenshot = attachment.screenshotData
    ? await window.Signal.Migrations.writeNewDraftData(
        attachment.screenshotData
      )
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
