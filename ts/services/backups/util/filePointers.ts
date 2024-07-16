// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';

import {
  APPLICATION_OCTET_STREAM,
  stringToMIMEType,
} from '../../../types/MIME';
import * as log from '../../../logging/log';
import {
  type AttachmentType,
  isDownloadableFromTransitTier,
  isDownloadableFromBackupTier,
  isAttachmentLocallySaved,
  type AttachmentDownloadableFromTransitTier,
  type AttachmentDownloadableFromBackupTier,
  type LocallySavedAttachment,
  type AttachmentReadyForBackup,
  isDecryptable,
  isReencryptableToSameDigest,
} from '../../../types/Attachment';
import { Backups, SignalService } from '../../../protobuf';
import * as Bytes from '../../../Bytes';
import { getTimestampFromLong } from '../../../util/timestampLongUtils';
import {
  encryptAttachmentV2,
  generateAttachmentKeys,
} from '../../../AttachmentCrypto';
import { strictAssert } from '../../../util/assert';
import type { CoreAttachmentBackupJobType } from '../../../types/AttachmentBackup';
import {
  type GetBackupCdnInfoType,
  getMediaIdForAttachment,
  getMediaIdFromMediaName,
  getMediaNameForAttachment,
} from './mediaId';
import { redactGenericText } from '../../../util/privacy';
import { missingCaseError } from '../../../util/missingCaseError';
import { toLogFormat } from '../../../types/errors';
import { bytesToUuid } from '../../../util/uuidToBytes';

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

export function convertBackupMessageAttachmentToAttachment(
  messageAttachment: Backups.IMessageAttachment
): AttachmentType | null {
  const { clientUuid } = messageAttachment;

  if (!messageAttachment.pointer) {
    return null;
  }
  const result = {
    ...convertFilePointerToAttachment(messageAttachment.pointer),
    clientUuid: clientUuid ? bytesToUuid(clientUuid) : undefined,
  };

  switch (messageAttachment.flag) {
    case Backups.MessageAttachment.Flag.VOICE_MESSAGE:
      result.flags = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;
      break;
    case Backups.MessageAttachment.Flag.BORDERLESS:
      result.flags = SignalService.AttachmentPointer.Flags.BORDERLESS;
      break;
    case Backups.MessageAttachment.Flag.GIF:
      result.flags = SignalService.AttachmentPointer.Flags.GIF;
      break;
    case Backups.MessageAttachment.Flag.NONE:
    case null:
    case undefined:
      result.flags = undefined;
      break;
    default:
      throw missingCaseError(messageAttachment.flag);
  }

  return result;
}

/**
 * Some attachments saved on desktop do not include the key used to encrypt the file
 * originally. This means that we need to encrypt the file in-memory now (at
 * export-creation time) to calculate the digest which will be saved in the backup proto
 * along with the new keys.
 */

async function generateNewEncryptionInfoForAttachment(
  attachment: Readonly<LocallySavedAttachment>
): Promise<AttachmentReadyForBackup> {
  const fixedUpAttachment = { ...attachment };

  // Since we are changing the encryption, we need to delete all encryption & location
  // related info
  delete fixedUpAttachment.cdnId;
  delete fixedUpAttachment.cdnKey;
  delete fixedUpAttachment.cdnNumber;
  delete fixedUpAttachment.backupLocator;
  delete fixedUpAttachment.uploadTimestamp;
  delete fixedUpAttachment.digest;
  delete fixedUpAttachment.iv;
  delete fixedUpAttachment.key;

  const keys = generateAttachmentKeys();

  // encrypt this file without writing the ciphertext to disk in order to calculate the
  // digest
  const { digest, iv } = await encryptAttachmentV2({
    keys,
    plaintext: {
      absolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath(
        attachment.path
      ),
    },
    getAbsoluteAttachmentPath:
      window.Signal.Migrations.getAbsoluteAttachmentPath,
  });

  return {
    ...fixedUpAttachment,
    digest: Bytes.toBase64(digest),
    iv: Bytes.toBase64(iv),
    key: Bytes.toBase64(keys),
  };
}

export async function getFilePointerForAttachment({
  attachment,
  backupLevel,
  getBackupCdnInfo,
}: {
  attachment: AttachmentType;
  backupLevel: BackupLevel;
  getBackupCdnInfo: GetBackupCdnInfoType;
}): Promise<{
  filePointer: Backups.FilePointer;
  updatedAttachment?: AttachmentType;
}> {
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
  const logId = `getFilePointerForAttachment(${redactGenericText(
    attachment.digest ?? ''
  )})`;

  if (attachment.size == null) {
    log.warn(`${logId}: attachment had nullish size, dropping`);
    return {
      filePointer: new Backups.FilePointer({
        ...filePointerRootProps,
        invalidAttachmentLocator: getInvalidAttachmentLocator(),
      }),
    };
  }

  if (!isAttachmentLocallySaved(attachment)) {
    // 1. If the attachment is undownloaded, we cannot trust its digest / mediaName. Thus,
    // we only include a BackupLocator if this attachment already had one (e.g. we
    // restored it from a backup and it had a BackupLocator then, which means we have at
    // one point in the past verified the digest).
    if (
      isDownloadableFromBackupTier(attachment) &&
      backupLevel === BackupLevel.Media
    ) {
      return {
        filePointer: new Backups.FilePointer({
          ...filePointerRootProps,
          backupLocator: getBackupLocator(attachment),
        }),
      };
    }

    // 2. Otherwise, we only return the transit CDN info via AttachmentLocator
    if (isDownloadableFromTransitTier(attachment)) {
      return {
        filePointer: new Backups.FilePointer({
          ...filePointerRootProps,
          attachmentLocator: getAttachmentLocator(attachment),
        }),
      };
    }

    // 3. Otherwise, we don't have the attachment, and we don't have info to download it
    return {
      filePointer: new Backups.FilePointer({
        ...filePointerRootProps,
        invalidAttachmentLocator: getInvalidAttachmentLocator(),
      }),
    };
  }

  // The attachment is locally saved
  if (backupLevel !== BackupLevel.Media) {
    // 1. If we have information to donwnload the file from the transit tier, great, let's
    //    just create an attachmentLocator so the restorer can try to download from the
    //    transit tier
    if (isDownloadableFromTransitTier(attachment)) {
      return {
        filePointer: new Backups.FilePointer({
          ...filePointerRootProps,
          attachmentLocator: getAttachmentLocator(attachment),
        }),
      };
    }

    // 2. Otherwise, we have the attachment locally, but we don't have information to put
    //    in the backup proto to allow the restorer to download it. (This shouldn't
    //    happen!)
    log.warn(
      `${logId}: Attachment is downloaded but we lack information to decrypt it`
    );
    return {
      filePointer: new Backups.FilePointer({
        ...filePointerRootProps,
        invalidAttachmentLocator: getInvalidAttachmentLocator(),
      }),
    };
  }

  // Some attachments (e.g. those quoted ones copied from the original message) may not
  // have any encryption info, including a digest.
  if (attachment.digest) {
    // From here on, this attachment is headed to (or already on) the backup tier!
    const mediaNameForCurrentVersionOfAttachment =
      getMediaNameForAttachment(attachment);

    const backupCdnInfo = await getBackupCdnInfo(
      getMediaIdFromMediaName(mediaNameForCurrentVersionOfAttachment).string
    );

    // We can generate a backupLocator for this mediaName iff
    // 1. we have iv, key, and digest so we can re-encrypt to the existing digest when
    //    uploading, or
    // 2. the mediaId is already in the backup tier and we have the key & digest to
    //    decrypt and verify it
    if (
      isReencryptableToSameDigest(attachment) ||
      (backupCdnInfo.isInBackupTier && isDecryptable(attachment))
    ) {
      return {
        filePointer: new Backups.FilePointer({
          ...filePointerRootProps,
          backupLocator: getBackupLocator({
            ...attachment,
            backupLocator: {
              mediaName: mediaNameForCurrentVersionOfAttachment,
              cdnNumber: backupCdnInfo.isInBackupTier
                ? backupCdnInfo.cdnNumber
                : undefined,
            },
          }),
        }),
      };
    }
  }

  let attachmentWithNewEncryptionInfo: AttachmentReadyForBackup | undefined;
  try {
    log.info(`${logId}: Generating new encryption info for attachment`);
    attachmentWithNewEncryptionInfo =
      await generateNewEncryptionInfoForAttachment(attachment);
  } catch (e) {
    log.error(
      `${logId}: Error when generating new encryption info for attachment`,
      toLogFormat(e)
    );

    return {
      filePointer: new Backups.FilePointer({
        ...filePointerRootProps,
        invalidAttachmentLocator: getInvalidAttachmentLocator(),
      }),
    };
  }

  return {
    filePointer: new Backups.FilePointer({
      ...filePointerRootProps,
      backupLocator: getBackupLocator({
        ...attachmentWithNewEncryptionInfo,
        backupLocator: {
          mediaName: getMediaNameForAttachment(attachmentWithNewEncryptionInfo),
          cdnNumber: undefined,
        },
      }),
    }),
    updatedAttachment: attachmentWithNewEncryptionInfo,
  };
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

export async function maybeGetBackupJobForAttachmentAndFilePointer({
  attachment,
  filePointer,
  getBackupCdnInfo,
  messageReceivedAt,
}: {
  attachment: AttachmentType;
  filePointer: Backups.FilePointer;
  getBackupCdnInfo: GetBackupCdnInfoType;
  messageReceivedAt: number;
}): Promise<CoreAttachmentBackupJobType | null> {
  if (!filePointer.backupLocator) {
    return null;
  }

  const mediaName = getMediaNameForAttachment(attachment);
  strictAssert(mediaName, 'mediaName must exist');

  const { isInBackupTier } = await getBackupCdnInfo(
    getMediaIdForAttachment(attachment).string
  );

  if (isInBackupTier) {
    return null;
  }

  strictAssert(
    isReencryptableToSameDigest(attachment),
    'Attachment must now have all required info for re-encryption'
  );

  strictAssert(
    isAttachmentLocallySaved(attachment),
    'Attachment must be saved locally for it to be backed up'
  );

  const {
    path,
    contentType,
    key: keys,
    digest,
    iv,
    size,
    cdnKey,
    cdnNumber,
    uploadTimestamp,
    version,
    localKey,
  } = attachment;

  return {
    mediaName,
    receivedAt: messageReceivedAt,
    type: 'standard',
    data: {
      path,
      contentType,
      keys,
      digest,
      iv,
      size,
      version,
      localKey,
      transitCdnInfo:
        cdnKey && cdnNumber != null
          ? {
              cdnKey,
              cdnNumber,
              uploadTimestamp,
            }
          : undefined,
    },
  };
}
