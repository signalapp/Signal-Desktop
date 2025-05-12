// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import {
  type AttachmentType,
  getAttachmentIdForLogging,
} from '../types/Attachment';
import * as log from '../logging/log';
import { toLogFormat } from '../types/errors';
import {
  decryptAndReencryptLocally,
  type ReencryptedAttachmentV2,
} from '../AttachmentCrypto';
import { strictAssert } from './assert';

export class AttachmentPermanentlyUndownloadableError extends Error {}

export async function downloadAttachmentFromLocalBackup(
  attachment: AttachmentType
): Promise<ReencryptedAttachmentV2> {
  const attachmentId = getAttachmentIdForLogging(attachment);
  const dataId = `${attachmentId}`;
  const logId = `downloadAttachmentFromLocalBackup(${dataId})`;

  try {
    return await doDownloadFromLocalBackup(attachment, { logId });
  } catch (error) {
    log.error(
      `${logId}: error when copying from local backup`,
      toLogFormat(error)
    );
    throw new AttachmentPermanentlyUndownloadableError();
  }
}

async function doDownloadFromLocalBackup(
  attachment: AttachmentType,
  {
    logId,
  }: {
    logId: string;
  }
): Promise<ReencryptedAttachmentV2> {
  const { digest, localBackupPath, localKey, size } = attachment;

  strictAssert(digest, `${logId}: missing digest`);
  strictAssert(localKey, `${logId}: missing localKey`);
  strictAssert(localBackupPath, `${logId}: missing localBackupPath`);
  strictAssert(isNumber(size), `${logId}: missing size`);

  return decryptAndReencryptLocally({
    type: 'local',
    ciphertextPath: localBackupPath,
    idForLogging: logId,
    keysBase64: localKey,
    size,
    getAbsoluteAttachmentPath:
      window.Signal.Migrations.getAbsoluteAttachmentPath,
  });
}
