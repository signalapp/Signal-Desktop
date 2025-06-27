// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync } from 'node:fs';
import { isNumber } from 'lodash';
import {
  type BackupableAttachmentType,
  getAttachmentIdForLogging,
} from '../types/Attachment';
import {
  decryptAndReencryptLocally,
  type ReencryptedAttachmentV2,
} from '../AttachmentCrypto';
import { strictAssert } from './assert';

export class AttachmentPermanentlyUndownloadableError extends Error {}

export async function downloadAttachmentFromLocalBackup(
  attachment: BackupableAttachmentType
): Promise<ReencryptedAttachmentV2> {
  const attachmentId = getAttachmentIdForLogging(attachment);
  const dataId = `${attachmentId}`;
  const logId = `downloadAttachmentFromLocalBackup(${dataId})`;

  return doDownloadFromLocalBackup(attachment, { logId });
}

async function doDownloadFromLocalBackup(
  attachment: BackupableAttachmentType,
  {
    logId,
  }: {
    logId: string;
  }
): Promise<ReencryptedAttachmentV2> {
  const { plaintextHash, localBackupPath, localKey, size } = attachment;

  strictAssert(plaintextHash, `${logId}: missing plaintextHash`);
  strictAssert(localKey, `${logId}: missing localKey`);
  strictAssert(localBackupPath, `${logId}: missing localBackupPath`);
  strictAssert(isNumber(size), `${logId}: missing size`);

  if (!existsSync(localBackupPath)) {
    throw new AttachmentPermanentlyUndownloadableError(
      'No file at attachment localBackupPath'
    );
  }

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
