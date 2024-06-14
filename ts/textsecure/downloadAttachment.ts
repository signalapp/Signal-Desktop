// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createWriteStream } from 'fs';
import { isNumber } from 'lodash';
import type { Readable } from 'stream';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { ensureFile } from 'fs-extra';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { strictAssert } from '../util/assert';
import {
  AttachmentSizeError,
  mightBeOnBackupTier,
  type AttachmentType,
} from '../types/Attachment';
import * as MIME from '../types/MIME';
import * as Bytes from '../Bytes';
import {
  deriveBackupMediaKeyMaterial,
  type BackupMediaKeyMaterialType,
} from '../Crypto';
import {
  decryptAttachmentV2,
  getAttachmentCiphertextLength,
  safeUnlinkSync,
  splitKeys,
} from '../AttachmentCrypto';
import type { ProcessedAttachment } from './Types.d';
import type { WebAPIType } from './WebAPI';
import { createName, getRelativePath } from '../windows/attachments';
import { MediaTier } from '../types/AttachmentDownload';
import { getBackupKey } from '../services/backups/crypto';
import { backupsService } from '../services/backups';
import { getMediaIdForAttachment } from '../services/backups/util/mediaId';

const DEFAULT_BACKUP_CDN_NUMBER = 3;

export function getCdnKey(attachment: ProcessedAttachment): string {
  const cdnKey = attachment.cdnId || attachment.cdnKey;
  strictAssert(cdnKey, 'Attachment was missing cdnId or cdnKey');
  return cdnKey;
}

function getBackupMediaKeyMaterial(
  attachment: AttachmentType
): BackupMediaKeyMaterialType {
  const mediaId = getMediaIdForAttachment(attachment);
  const backupKey = getBackupKey();
  return deriveBackupMediaKeyMaterial(backupKey, mediaId.bytes);
}

export async function getCdnNumberForBackupTier(
  attachment: ProcessedAttachment
): Promise<number> {
  strictAssert(
    attachment.backupLocator,
    'Attachment was missing backupLocator'
  );
  let backupCdnNumber = attachment.backupLocator.cdnNumber;

  if (backupCdnNumber == null) {
    const mediaId = getMediaIdForAttachment(attachment);
    const backupCdnInfo = await backupsService.getBackupCdnInfo(mediaId.string);
    if (backupCdnInfo.isInBackupTier) {
      backupCdnNumber = backupCdnInfo.cdnNumber;
    } else {
      backupCdnNumber = DEFAULT_BACKUP_CDN_NUMBER;
    }
  }
  return backupCdnNumber;
}

export async function downloadAttachment(
  server: WebAPIType,
  attachment: ProcessedAttachment,
  options?: {
    disableRetries?: boolean;
    timeout?: number;
    mediaTier?: MediaTier;
    logPrefix?: string;
  }
): Promise<AttachmentType> {
  const logId = `${options?.logPrefix}/downloadAttachment`;

  const { digest, key, size, contentType } = attachment;

  strictAssert(digest, `${logId}: missing digest`);
  strictAssert(key, `${logId}: missing key`);
  strictAssert(isNumber(size), `${logId}: missing size`);

  const mediaTier =
    options?.mediaTier ??
    (mightBeOnBackupTier(attachment) ? MediaTier.BACKUP : MediaTier.STANDARD);

  let downloadedPath: string;
  if (mediaTier === MediaTier.STANDARD) {
    const cdnKey = getCdnKey(attachment);
    const { cdnNumber } = attachment;

    const downloadStream = await server.getAttachment({
      cdnKey,
      cdnNumber,
      options,
    });
    downloadedPath = await downloadToDisk({ downloadStream, size });
  } else {
    const mediaId = getMediaIdForAttachment(attachment);
    const cdnNumber = await getCdnNumberForBackupTier(attachment);
    const cdnCredentials =
      await backupsService.credentials.getCDNReadCredentials(cdnNumber);

    const backupDir = await backupsService.api.getBackupDir();
    const mediaDir = await backupsService.api.getMediaDir();

    const downloadStream = await server.getAttachmentFromBackupTier({
      mediaId: mediaId.string,
      backupDir,
      mediaDir,
      headers: cdnCredentials.headers,
      cdnNumber,
      options,
    });
    downloadedPath = await downloadToDisk({
      downloadStream,
      size: getAttachmentCiphertextLength(size),
    });
  }

  const cipherTextAbsolutePath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(downloadedPath);

  const { aesKey, macKey } = splitKeys(Bytes.fromBase64(key));
  const { path, plaintextHash, iv } = await decryptAttachmentV2({
    ciphertextPath: cipherTextAbsolutePath,
    idForLogging: logId,
    aesKey,
    macKey,
    size,
    theirDigest: Bytes.fromBase64(digest),
    outerEncryption:
      mediaTier === 'backup'
        ? getBackupMediaKeyMaterial(attachment)
        : undefined,
  });

  safeUnlinkSync(cipherTextAbsolutePath);

  return {
    ...attachment,
    path,
    size,
    contentType: contentType
      ? MIME.stringToMIMEType(contentType)
      : MIME.APPLICATION_OCTET_STREAM,
    plaintextHash,
    iv: Bytes.toBase64(iv),
  };
}

async function downloadToDisk({
  downloadStream,
  size,
}: {
  downloadStream: Readable;
  size: number;
}): Promise<string> {
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);
  await ensureFile(absoluteTargetPath);
  const writeStream = createWriteStream(absoluteTargetPath);
  const targetSize = getAttachmentCiphertextLength(size);

  try {
    await pipeline(downloadStream, checkSize(targetSize), writeStream);
  } catch (error) {
    try {
      safeUnlinkSync(absoluteTargetPath);
    } catch (cleanupError) {
      log.error(
        'downloadToDisk: Error while cleaning up',
        Errors.toLogFormat(cleanupError)
      );
    }

    throw error;
  }

  return relativeTargetPath;
}

// A simple transform that throws if it sees more than maxBytes on the stream.
function checkSize(expectedBytes: number) {
  let totalBytes = 0;

  // TODO (DESKTOP-7046): remove size buffer
  const maximumSizeBeforeError = expectedBytes * 1.05;
  return new Transform({
    transform(chunk, encoding, callback) {
      totalBytes += chunk.byteLength;
      if (totalBytes > maximumSizeBeforeError) {
        callback(
          new AttachmentSizeError(
            `checkSize: Received ${totalBytes} bytes, max is ${maximumSizeBeforeError}`
          )
        );
        return;
      }

      if (totalBytes > expectedBytes) {
        log.warn(
          `checkSize: Received ${totalBytes} bytes, expected ${expectedBytes}`
        );
      }

      this.push(chunk, encoding);
      callback();
    },
  });
}
