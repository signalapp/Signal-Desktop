// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import { doesAttachmentExist } from '../migrations.preload.ts';

import { type MIMEType, stringToMIMEType } from '../../types/MIME.std.ts';
import { strictAssert } from '../assert.std.ts';
import { type WithRequiredProperties } from '../../types/Util.std.ts';
import { type AttachmentType } from '../../types/Attachment.std.ts';
import { CURRENT_ATTACHMENT_VERSION } from '../../../app/attachments.node.ts';

const log = createLogger('deduplicateAttachment');

type AttachmentDataToBeReused = WithRequiredProperties<
  Pick<
    AttachmentType,
    | 'path'
    | 'localKey'
    | 'version'
    | 'thumbnail'
    | 'screenshot'
    | 'width'
    | 'height'
  >,
  'path' | 'localKey' | 'version'
>;

export async function getExistingAttachmentDataForReuse({
  plaintextHash,
  contentType,
  messageId,
  logId,
}: {
  plaintextHash: string;
  contentType: MIMEType;
  messageId: string;
  logId?: string;
}): Promise<AttachmentDataToBeReused | null> {
  const existingAttachmentData =
    await DataWriter.getAndProtectExistingAttachmentPath({
      plaintextHash,
      version: CURRENT_ATTACHMENT_VERSION,
      contentType,
      messageId,
    });

  if (!existingAttachmentData) {
    return null;
  }

  strictAssert(existingAttachmentData.path, 'path must exist for reuse');
  strictAssert(
    existingAttachmentData.version === CURRENT_ATTACHMENT_VERSION,
    'version mismatch'
  );
  strictAssert(existingAttachmentData.localKey, 'localKey must exist');

  if (!(await doesAttachmentExist(existingAttachmentData.path))) {
    log.warn(
      `${logId}: Existing attachment no longer exists, using newly downloaded one`
    );
    return null;
  }

  log.info(`${logId}: Reusing existing attachment`);

  const dataToReuse: AttachmentDataToBeReused = {
    path: existingAttachmentData.path,
    localKey: existingAttachmentData.localKey,
    version: existingAttachmentData.version,
    width: existingAttachmentData.width ?? undefined,
    height: existingAttachmentData.height ?? undefined,
  };
  const { thumbnailPath, thumbnailSize, thumbnailContentType } =
    existingAttachmentData;

  if (
    thumbnailPath &&
    thumbnailSize &&
    thumbnailContentType &&
    (await doesAttachmentExist(thumbnailPath))
  ) {
    dataToReuse.thumbnail = {
      path: thumbnailPath,
      localKey: existingAttachmentData.thumbnailLocalKey ?? undefined,
      version: existingAttachmentData.thumbnailVersion ?? undefined,
      size: thumbnailSize,
      contentType: stringToMIMEType(thumbnailContentType),
    };
  }

  const { screenshotPath, screenshotSize, screenshotContentType } =
    existingAttachmentData;
  if (
    screenshotPath &&
    screenshotSize &&
    screenshotContentType &&
    (await doesAttachmentExist(screenshotPath))
  ) {
    dataToReuse.screenshot = {
      path: screenshotPath,
      localKey: existingAttachmentData.screenshotLocalKey ?? undefined,
      version: existingAttachmentData.screenshotVersion ?? undefined,
      size: screenshotSize,
      contentType: stringToMIMEType(screenshotContentType),
    };
  }
  return dataToReuse;
}
