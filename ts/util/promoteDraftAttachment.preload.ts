// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CURRENT_ATTACHMENT_VERSION } from '../../app/attachments.node.ts';
import type {
  AttachmentDraftType,
  AttachmentType,
  ScreenshotType,
} from '../types/Attachment.std.ts';
import {
  copyDraftIntoAttachmentDirectory,
  getAbsoluteDraftPath,
} from './migrations.preload.ts';
import { getExistingAttachmentDataForReuse } from './attachments/deduplicateAttachment.preload.ts';

async function reuseOrCopy({
  plaintextHash,
  path,
  localKey,
  contentType,
}: Pick<
  AttachmentType,
  'plaintextHash' | 'path' | 'localKey' | 'contentType'
>): Promise<
  Pick<
    AttachmentType,
    | 'path'
    | 'localKey'
    | 'version'
    | 'thumbnail'
    | 'screenshot'
    | 'width'
    | 'height'
    | 'reuseToken'
  >
> {
  if (path == null) {
    return {};
  }

  if (plaintextHash != null) {
    const existingData = await getExistingAttachmentDataForReuse({
      plaintextHash,
      contentType,
      logId: 'promoteDraftAttachment',
    });

    if (existingData) {
      return existingData;
    }
  }

  const { path: newPath } = await copyDraftIntoAttachmentDirectory(
    getAbsoluteDraftPath(path)
  );

  return {
    version: CURRENT_ATTACHMENT_VERSION,
    path: newPath,
    localKey,
  };
}

export async function promoteDraftAttachment(
  attachment?: AttachmentDraftType
): Promise<AttachmentType | undefined> {
  if (!attachment || attachment.pending) {
    return;
  }

  if (!attachment.path) {
    return;
  }

  const newFields = await reuseOrCopy(attachment);

  let newScreenshot: ScreenshotType | undefined;
  if (attachment.screenshot != null) {
    const newScreenshotFields = await reuseOrCopy(attachment.screenshot);
    newScreenshot = {
      ...attachment.screenshot,
      ...newScreenshotFields,
    };
  }

  return {
    ...attachment,
    ...newFields,
    screenshot: newScreenshot,
  };
}
