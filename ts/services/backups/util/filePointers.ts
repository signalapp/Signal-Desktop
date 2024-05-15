// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';

import {
  APPLICATION_OCTET_STREAM,
  stringToMIMEType,
} from '../../../types/MIME';
import {
  type AttachmentType,
  isDownloadableFromTransitTier,
  isDownloadableFromBackupTier,
  isDownloadedToLocalFile,
  type AttachmentDownloadableFromTransitTier,
  type AttachmentDownloadableFromBackupTier,
  type DownloadedAttachment,
  type AttachmentReadyForBackup,
} from '../../../types/Attachment';
import { Backups } from '../../../protobuf';
import * as Bytes from '../../../Bytes';
import { getTimestampFromLong } from '../../../util/timestampLongUtils';
import { getRandomBytes } from '../../../Crypto';
import { encryptAttachmentV2 } from '../../../AttachmentCrypto';
import { strictAssert } from '../../../util/assert';

export function convertFilePointerToAttachment(
  filePointer: Backups.FilePointer
): AttachmentType {
  const {
    contentType,
    width,
    height,
    fileName,
    caption,
    blurHash,
    incrementalMac,
    incrementalMacChunkSize,
    attachmentLocator,
    backupLocator,
    invalidAttachmentLocator,
  } = filePointer;

  const commonProps: Omit<AttachmentType, 'size'> = {
    contentType: contentType
      ? stringToMIMEType(contentType)
      : APPLICATION_OCTET_STREAM,
    width: width ?? undefined,
    height: height ?? undefined,
    fileName: fileName ?? undefined,
    caption: caption ?? undefined,
    blurHash: blurHash ?? undefined,
    incrementalMac: incrementalMac?.length
      ? Bytes.toBase64(incrementalMac)
      : undefined,
    incrementalMacChunkSize: incrementalMacChunkSize ?? undefined,
  };

  if (attachmentLocator) {
    const { cdnKey, cdnNumber, key, digest, uploadTimestamp, size } =
      attachmentLocator;
    return {
      ...commonProps,
      size: size ?? 0,
      cdnKey: cdnKey ?? undefined,
      cdnNumber: cdnNumber ?? undefined,
      key: key?.length ? Bytes.toBase64(key) : undefined,
      digest: digest?.length ? Bytes.toBase64(digest) : undefined,
      uploadTimestamp: uploadTimestamp
        ? getTimestampFromLong(uploadTimestamp)
        : undefined,
    };
  }

  if (backupLocator) {
    const {
      mediaName,
      cdnNumber,
      key,
      digest,
      size,
      transitCdnKey,
      transitCdnNumber,
    } = backupLocator;

    return {
      ...commonProps,
      cdnKey: transitCdnKey ?? undefined,
      cdnNumber: transitCdnNumber ?? undefined,
      key: key?.length ? Bytes.toBase64(key) : undefined,
      digest: digest?.length ? Bytes.toBase64(digest) : undefined,
      size: size ?? 0,
      backupLocator: mediaName
        ? {
            mediaName,
            cdnNumber: cdnNumber ?? undefined,
          }
        : undefined,
    };
  }

  if (invalidAttachmentLocator) {
    return {
      ...commonProps,
      error: true,
      size: 0,
    };
  }

  throw new Error('convertFilePointerToAttachment: mising locator');
}

/**
 * Some attachments saved on desktop do not include the key used to encrypt the file
 * originally. This means that we need to encrypt the file in-memory now (at
 * export-creation time) to calculate the digest which will be saved in the backup proto
 * along with the new keys.
 */
async function fixupAttachmentForBackup(
  attachment: DownloadedAttachment
): Promise<AttachmentReadyForBackup> {
  const fixedUpAttachment = { ...attachment };
  const keyToUse = attachment.key ?? Bytes.toBase64(getRandomBytes(64));
  let digestToUse = attachment.key ? attachment.digest : undefined;

  if (!digestToUse) {
    // Delete current locators for the attachment; we can no longer use them and will need
    // to fully re-encrypt and upload
    delete fixedUpAttachment.cdnId;
    delete fixedUpAttachment.cdnKey;
    delete fixedUpAttachment.cdnNumber;

    // encrypt this file in memory in order to calculate the digest
    const { digest } = await encryptAttachmentV2({
      keys: Bytes.fromBase64(keyToUse),
      plaintextAbsolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath(
        attachment.path
      ),
    });

    digestToUse = Bytes.toBase64(digest);

    // TODO (DESKTOP-6688): ensure that we update the message/attachment in DB with the
    // new keys so that we don't try to re-upload it again on the next export
  }

  return {
    ...fixedUpAttachment,
    key: keyToUse,
    digest: digestToUse,
  };
}

export async function convertAttachmentToFilePointer({
  attachment,
  backupLevel,
  getBackupTierInfo,
}: {
  attachment: AttachmentType;
  backupLevel: BackupLevel;
  getBackupTierInfo: (
    mediaName: string
  ) => { isInBackupTier: true; cdnNumber: number } | { isInBackupTier: false };
}): Promise<Backups.FilePointer> {
  const filePointerRootProps = new Backups.FilePointer({
    contentType: attachment.contentType,
    incrementalMac: attachment.incrementalMac
      ? Bytes.fromBase64(attachment.incrementalMac)
      : undefined,
    incrementalMacChunkSize: attachment.incrementalMacChunkSize,
    fileName: attachment.fileName,
    width: attachment.width,
    height: attachment.height,
    caption: attachment.caption,
    blurHash: attachment.blurHash,
  });

  if (!isDownloadedToLocalFile(attachment)) {
    // 1. If the attachment is undownloaded, we cannot trust its digest / mediaName. Thus,
    // we only include a BackupLocator if this attachment already had one (e.g. we
    // restored it from a backup and it had a BackupLocator then, which means we have at
    // one point in the past verified the digest).
    if (
      isDownloadableFromBackupTier(attachment) &&
      backupLevel === BackupLevel.Media
    ) {
      return new Backups.FilePointer({
        ...filePointerRootProps,
        backupLocator: getBackupLocator(attachment),
      });
    }

    // 2. Otherwise, we only return the transit CDN info via AttachmentLocator
    if (isDownloadableFromTransitTier(attachment)) {
      return new Backups.FilePointer({
        ...filePointerRootProps,
        attachmentLocator: getAttachmentLocator(attachment),
      });
    }
  }

  if (backupLevel !== BackupLevel.Media) {
    if (isDownloadableFromTransitTier(attachment)) {
      return new Backups.FilePointer({
        ...filePointerRootProps,
        attachmentLocator: getAttachmentLocator(attachment),
      });
    }
    return new Backups.FilePointer({
      ...filePointerRootProps,
      invalidAttachmentLocator: getInvalidAttachmentLocator(),
    });
  }

  if (!isDownloadedToLocalFile(attachment)) {
    return new Backups.FilePointer({
      ...filePointerRootProps,
      invalidAttachmentLocator: getInvalidAttachmentLocator(),
    });
  }

  const attachmentForBackup = await fixupAttachmentForBackup(attachment);
  const mediaName = getMediaNameForAttachment(attachmentForBackup);

  const backupTierInfo = getBackupTierInfo(mediaName);
  let cdnNumberInBackupTier: number | undefined;
  if (backupTierInfo.isInBackupTier) {
    cdnNumberInBackupTier = backupTierInfo.cdnNumber;
  }

  return new Backups.FilePointer({
    ...filePointerRootProps,
    backupLocator: getBackupLocator({
      ...attachmentForBackup,
      backupLocator: {
        mediaName,
        cdnNumber: cdnNumberInBackupTier,
      },
    }),
  });
}

export function getMediaNameForAttachment(attachment: AttachmentType): string {
  strictAssert(attachment.digest, 'Digest must be present');
  return attachment.digest;
}

// mediaId is special in that it is encoded in base64url
export function getBytesFromMediaId(mediaId: string): Uint8Array {
  return Bytes.fromBase64url(mediaId);
}

function getAttachmentLocator(
  attachment: AttachmentDownloadableFromTransitTier
) {
  return new Backups.FilePointer.AttachmentLocator({
    cdnKey: attachment.cdnKey,
    cdnNumber: attachment.cdnNumber,
    uploadTimestamp: attachment.uploadTimestamp
      ? Long.fromNumber(attachment.uploadTimestamp)
      : null,
    digest: Bytes.fromBase64(attachment.digest),
    key: Bytes.fromBase64(attachment.key),
    size: attachment.size,
  });
}

function getBackupLocator(attachment: AttachmentDownloadableFromBackupTier) {
  return new Backups.FilePointer.BackupLocator({
    mediaName: attachment.backupLocator.mediaName,
    cdnNumber: attachment.backupLocator.cdnNumber,
    digest: Bytes.fromBase64(attachment.digest),
    key: Bytes.fromBase64(attachment.key),
    size: attachment.size,
    transitCdnKey: attachment.cdnKey,
    transitCdnNumber: attachment.cdnNumber,
  });
}

function getInvalidAttachmentLocator() {
  return new Backups.FilePointer.InvalidAttachmentLocator();
}
