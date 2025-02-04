// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { omit } from 'lodash';

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
  isDecryptable,
  isReencryptableToSameDigest,
  isReencryptableWithNewEncryptionInfo,
  type ReencryptableAttachment,
} from '../../../types/Attachment';
import { Backups, SignalService } from '../../../protobuf';
import * as Bytes from '../../../Bytes';
import { getTimestampFromLong } from '../../../util/timestampLongUtils';
import { strictAssert } from '../../../util/assert';
import type { CoreAttachmentBackupJobType } from '../../../types/AttachmentBackup';
import {
  type GetBackupCdnInfoType,
  getMediaIdFromMediaName,
  getMediaNameForAttachment,
  getMediaNameFromDigest,
  type BackupCdnInfoType,
} from './mediaId';
import { redactGenericText } from '../../../util/privacy';
import { missingCaseError } from '../../../util/missingCaseError';
import { toLogFormat } from '../../../types/errors';
import { bytesToUuid } from '../../../util/uuidToBytes';
import { createName } from '../../../util/attachmentPath';
import { ensureAttachmentIsReencryptable } from '../../../util/ensureAttachmentIsReencryptable';
import type { ReencryptionInfo } from '../../../AttachmentCrypto';
import { dropZero } from '../../../util/dropZero';

export function convertFilePointerToAttachment(
  filePointer: Backups.FilePointer,
  // Only for testing
  { _createName: doCreateName = createName } = {}
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
    chunkSize: dropZero(incrementalMacChunkSize),
    downloadPath: doCreateName(),
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

  if (!invalidAttachmentLocator) {
    log.error('convertFilePointerToAttachment: filePointer had no locator');
  }

  return {
    ...omit(commonProps, 'downloadPath'),
    error: true,
    size: 0,
  };
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

export async function getFilePointerForAttachment({
  attachment,
  backupLevel,
  getBackupCdnInfo,
}: {
  attachment: Readonly<AttachmentType>;
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
    incrementalMacChunkSize: dropZero(attachment.chunkSize),
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
      backupLevel === BackupLevel.Paid
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
  if (backupLevel !== BackupLevel.Paid) {
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

  // From here on, this attachment is headed to (or already on) the backup tier!
  const mediaNameForCurrentVersionOfAttachment = attachment.digest
    ? getMediaNameForAttachment(attachment)
    : undefined;

  const backupCdnInfo: BackupCdnInfoType =
    mediaNameForCurrentVersionOfAttachment
      ? await getBackupCdnInfo(
          getMediaIdFromMediaName(mediaNameForCurrentVersionOfAttachment).string
        )
      : { isInBackupTier: false };

  // If we have key & digest for this attachment and it's already on backup tier, we can
  // reference it
  if (isDecryptable(attachment) && backupCdnInfo.isInBackupTier) {
    strictAssert(mediaNameForCurrentVersionOfAttachment, 'must exist');
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

  let reencryptableAttachment: ReencryptableAttachment;
  try {
    reencryptableAttachment = await ensureAttachmentIsReencryptable(attachment);
  } catch (e) {
    log.warn('Unable to ensure attachment is reencryptable', toLogFormat(e));
    return {
      filePointer: new Backups.FilePointer({
        ...filePointerRootProps,
        invalidAttachmentLocator: getInvalidAttachmentLocator(),
      }),
    };
  }

  // If we've confirmed that we can re-encrypt this attachment to the same digest, we can
  // generate a backupLocator (and upload the file)
  if (isReencryptableToSameDigest(reencryptableAttachment)) {
    return {
      filePointer: new Backups.FilePointer({
        ...filePointerRootProps,
        backupLocator: getBackupLocator({
          ...reencryptableAttachment,
          backupLocator: {
            mediaName: getMediaNameFromDigest(reencryptableAttachment.digest),
            cdnNumber: backupCdnInfo.isInBackupTier
              ? backupCdnInfo.cdnNumber
              : undefined,
          },
        }),
      }),
      updatedAttachment: reencryptableAttachment,
    };
  }

  strictAssert(
    reencryptableAttachment.reencryptionInfo,
    'Reencryption info must exist if not reencryptable to original digest'
  );

  const mediaNameForNewEncryptionInfo = getMediaNameFromDigest(
    reencryptableAttachment.reencryptionInfo.digest
  );
  const backupCdnInfoForNewEncryptionInfo = await getBackupCdnInfo(
    getMediaIdFromMediaName(mediaNameForNewEncryptionInfo).string
  );

  return {
    filePointer: new Backups.FilePointer({
      ...filePointerRootProps,
      backupLocator: getBackupLocator({
        size: reencryptableAttachment.size,
        ...reencryptableAttachment.reencryptionInfo,
        backupLocator: {
          mediaName: mediaNameForNewEncryptionInfo,
          cdnNumber: backupCdnInfoForNewEncryptionInfo.isInBackupTier
            ? backupCdnInfoForNewEncryptionInfo.cdnNumber
            : undefined,
        },
      }),
    }),
    updatedAttachment: reencryptableAttachment,
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

function getBackupLocator(
  attachment: Pick<
    AttachmentDownloadableFromBackupTier,
    'backupLocator' | 'digest' | 'key' | 'size' | 'cdnKey' | 'cdnNumber'
  >
) {
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

  const { mediaName } = filePointer.backupLocator;
  strictAssert(mediaName, 'mediaName must exist');

  const { isInBackupTier } = await getBackupCdnInfo(
    getMediaIdFromMediaName(mediaName).string
  );

  if (isInBackupTier) {
    return null;
  }

  strictAssert(
    isAttachmentLocallySaved(attachment),
    'Attachment must be saved locally for it to be backed up'
  );

  let encryptionInfo: ReencryptionInfo | undefined;

  if (isReencryptableToSameDigest(attachment)) {
    encryptionInfo = {
      iv: attachment.iv,
      key: attachment.key,
      digest: attachment.digest,
    };
  } else {
    strictAssert(
      isReencryptableWithNewEncryptionInfo(attachment) === true,
      'must have new encryption info'
    );
    encryptionInfo = attachment.reencryptionInfo;
  }

  strictAssert(
    filePointer.backupLocator.digest,
    'digest must exist on backupLocator'
  );
  strictAssert(
    encryptionInfo.digest === Bytes.toBase64(filePointer.backupLocator.digest),
    'digest on job and backupLocator must match'
  );

  const { path, contentType, size, uploadTimestamp, version, localKey } =
    attachment;

  const { transitCdnKey, transitCdnNumber } = filePointer.backupLocator;

  return {
    mediaName,
    receivedAt: messageReceivedAt,
    type: 'standard',
    data: {
      path,
      contentType,
      keys: encryptionInfo.key,
      digest: encryptionInfo.digest,
      iv: encryptionInfo.iv,
      size,
      version,
      localKey,
      transitCdnInfo:
        transitCdnKey != null && transitCdnNumber != null
          ? {
              cdnKey: transitCdnKey,
              cdnNumber: transitCdnNumber,
              uploadTimestamp,
            }
          : undefined,
    },
  };
}
