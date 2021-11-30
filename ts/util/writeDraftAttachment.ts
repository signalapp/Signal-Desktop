// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import type {
  InMemoryAttachmentDraftType,
  AttachmentDraftType,
} from '../types/Attachment';
import { isImageAttachment } from '../types/Attachment';
import { getImageDimensions } from '../types/VisualAttachment';
import * as Errors from '../types/errors';
import * as logger from '../logging/log';

export async function writeDraftAttachment(
  attachment: InMemoryAttachmentDraftType
): Promise<AttachmentDraftType> {
  if (attachment.pending) {
    throw new Error('writeDraftAttachment: Cannot write pending attachment');
  }

  const path = await window.Signal.Migrations.writeNewDraftData(
    attachment.data
  );

  const screenshotPath = attachment.screenshotData
    ? await window.Signal.Migrations.writeNewDraftData(
        attachment.screenshotData
      )
    : undefined;

  let dimensions: { width?: number; height?: number } = {};
  if (isImageAttachment(attachment)) {
    const url = window.Signal.Migrations.getAbsoluteDraftPath(path);

    try {
      dimensions = await getImageDimensions({
        objectUrl: url,
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
    path,
    screenshotPath,
    pending: false,
    ...dimensions,
  };
}
