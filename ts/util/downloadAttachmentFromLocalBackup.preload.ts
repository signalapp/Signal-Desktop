// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync } from 'node:fs';
import lodash from 'lodash';
import type { BackupableAttachmentType } from '../types/Attachment.std.ts';
import {
  decryptAndReencryptLocally,
  type ReencryptedAttachmentV2,
} from '../AttachmentCrypto.node.ts';
import { strictAssert } from './assert.std.ts';
import { getAbsoluteAttachmentPath } from './migrations.preload.ts';

const { isNumber } = lodash;

class AttachmentPermanentlyUndownloadableError extends Error {}

export async function downloadAttachmentFromLocalBackup(
  attachment: BackupableAttachmentType,
  { logId }: { logId: string }
): Promise<ReencryptedAttachmentV2> {
  return doDownloadFromLocalBackup(attachment, {
    logId: `downloadAttachmentFromLocalBackup(${logId})`,
  });
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
    getAbsoluteAttachmentPath,
  });
}
