// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup.js';

import {
  APPLICATION_OCTET_STREAM,
  stringToMIMEType,
} from '../../../types/MIME.std.js';
import type { AttachmentType } from '../../../types/Attachment.std.js';
import { doesAttachmentExist } from '../../../util/migrations.preload.js';
import {
  hasRequiredInformationForLocalBackup,
  hasRequiredInformationForRemoteBackup,
  hasRequiredInformationToDownloadFromTransitTier,
} from '../../../util/Attachment.std.js';
import { Backups, SignalService } from '../../../protobuf/index.std.js';
import * as Bytes from '../../../Bytes.std.js';
import {
  getSafeLongFromTimestamp,
  getTimestampFromLong,
} from '../../../util/timestampLongUtils.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import type {
  CoreAttachmentBackupJobType,
  CoreAttachmentLocalBackupJobType,
} from '../../../types/AttachmentBackup.std.js';
import {
  type GetBackupCdnInfoType,
  getMediaIdFromMediaName,
  getMediaName,
  getMediaNameForAttachment,
  type BackupCdnInfoType,
  getLocalBackupFileNameForAttachment,
  getLocalBackupFileName,
} from './mediaId.preload.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { bytesToUuid } from '../../../util/uuidToBytes.std.js';
import { createName } from '../../../util/attachmentPath.node.js';
import { generateAttachmentKeys } from '../../../AttachmentCrypto.node.js';
import { getAttachmentLocalBackupPathFromSnapshotDir } from './localBackup.node.js';
import {
  isValidAttachmentKey,
  isValidDigest,
  isValidPlaintextHash,
} from '../../../types/Crypto.std.js';
import type { BackupExportOptions, BackupImportOptions } from '../types.std.js';
import { isTestOrMockEnvironment } from '../../../environment.std.js';
import { toNumber } from '../../../util/toNumber.std.js';
import { isKnownProtoEnumMember } from '../../../util/isKnownProtoEnumMember.std.js';

export function convertFilePointerToAttachment(
  filePointer: Backups.FilePointer,
  options: BackupImportOptions,
  testDependencies?: { _createName: (suffix?: string) => string }
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
    locatorInfo,
  } = filePointer;
  const doCreateName = testDependencies?._createName ?? createName;

  const commonProps: AttachmentType = {
    size: 0,
    contentType: contentType
      ? stringToMIMEType(contentType)
      : APPLICATION_OCTET_STREAM,
    width: width ?? undefined,
    height: height ?? undefined,
    fileName: fileName ?? undefined,
    caption: caption ?? undefined,
    blurHash: blurHash ?? undefined,
    incrementalMac: undefined,
    chunkSize: undefined,
    downloadPath: doCreateName(),
  };

  if (Bytes.isNotEmpty(incrementalMac) && incrementalMacChunkSize) {
    commonProps.incrementalMac = Bytes.toBase64(incrementalMac);
    commonProps.chunkSize = incrementalMacChunkSize;
  }

  if (!locatorInfo) {
    return {
      ...commonProps,
      error: true,
      downloadPath: undefined,
    };
  }

  const {
    key,
    localKey,
    integrityCheck,
    size,
    transitCdnKey,
    transitCdnNumber,
    transitTierUploadTimestamp,
    mediaTierCdnNumber,
  } = locatorInfo;

  if (!Bytes.isNotEmpty(key)) {
    return {
      ...commonProps,
      error: true,
      downloadPath: undefined,
    };
  }

  let mediaName: string | undefined;
  if (
    Bytes.isNotEmpty(integrityCheck?.plaintextHash) &&
    Bytes.isNotEmpty(key)
  ) {
    mediaName =
      getMediaName({
        key,
        plaintextHash: integrityCheck.plaintextHash,
      }) ?? undefined;
  }

  let localBackupPath: string | undefined;
  if (
    options.type === 'local-encrypted' &&
    Bytes.isNotEmpty(localKey) &&
    Bytes.isNotEmpty(integrityCheck?.plaintextHash)
  ) {
    const localMediaName = getLocalBackupFileName({
      plaintextHash: integrityCheck.plaintextHash,
      localKey,
    });
    localBackupPath = getAttachmentLocalBackupPathFromSnapshotDir(
      localMediaName,
      options.localBackupSnapshotDir
    );
  }

  return {
    ...commonProps,
    key: Bytes.toBase64(key),
    digest: Bytes.isNotEmpty(integrityCheck?.encryptedDigest)
      ? Bytes.toBase64(integrityCheck.encryptedDigest)
      : undefined,
    size: size ?? 0,
    cdnKey: transitCdnKey ?? undefined,
    cdnNumber: transitCdnNumber ?? undefined,
    uploadTimestamp: transitTierUploadTimestamp
      ? getTimestampFromLong(transitTierUploadTimestamp)
      : undefined,
    plaintextHash: Bytes.isNotEmpty(integrityCheck?.plaintextHash)
      ? Bytes.toHex(integrityCheck.plaintextHash)
      : undefined,
    localBackupPath,
    // TODO: DESKTOP-8883
    localKey: Bytes.isNotEmpty(localKey) ? Bytes.toBase64(localKey) : undefined,
    ...(mediaName && mediaTierCdnNumber != null
      ? {
          backupCdnNumber: mediaTierCdnNumber,
        }
      : {}),
  };
}

export function convertBackupMessageAttachmentToAttachment(
  messageAttachment: Backups.MessageAttachment,
  options: BackupImportOptions
): AttachmentType | null {
  const { clientUuid } = messageAttachment;

  if (!messageAttachment.pointer) {
    return null;
  }
  const result = {
    ...convertFilePointerToAttachment(messageAttachment.pointer, options),
    clientUuid: clientUuid ? bytesToUuid(clientUuid) : undefined,
  };

  let { flag } = messageAttachment;
  if (!isKnownProtoEnumMember(Backups.MessageAttachment.Flag, flag)) {
    flag = Backups.MessageAttachment.Flag.NONE;
  }

  switch (flag) {
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
      result.flags = undefined;
      break;
    default:
      throw missingCaseError(flag);
  }

  return result;
}

export async function getFilePointerForAttachment({
  attachment: rawAttachment,
  getBackupCdnInfo,
  backupOptions,
  messageReceivedAt,
}: {
  attachment: Readonly<AttachmentType>;
  getBackupCdnInfo: GetBackupCdnInfoType;
  backupOptions: BackupExportOptions;
  messageReceivedAt: number;
}): Promise<{
  filePointer: Backups.FilePointer.Params;
  backupJob?: CoreAttachmentBackupJobType | CoreAttachmentLocalBackupJobType;
}> {
  const attachment = maybeFixupAttachment(rawAttachment);

  const filePointer: Backups.FilePointer.Params = {
    contentType: attachment.contentType,
    fileName: attachment.fileName ?? null,
    width: attachment.width ?? null,
    height: attachment.height ?? null,
    caption: attachment.caption ?? null,
    blurHash: attachment.blurHash ?? null,
    incrementalMac: null,
    incrementalMacChunkSize: null,
    locatorInfo: null,
  };

  // TODO: DESKTOP-9112
  if (isTestOrMockEnvironment()) {
    // Check for string type for resilience to invalid data in the database from internal
    // testing
    if (typeof attachment.incrementalMac === 'string' && attachment.chunkSize) {
      filePointer.incrementalMac = Bytes.fromBase64(attachment.incrementalMac);
      filePointer.incrementalMacChunkSize = attachment.chunkSize;
    }
  }

  const isAttachmentOnDisk =
    attachment.path != null && (await doesAttachmentExist(attachment.path));

  const remoteMediaName = hasRequiredInformationForRemoteBackup(attachment)
    ? getMediaNameForAttachment(attachment)
    : undefined;

  const remoteMediaId = remoteMediaName
    ? getMediaIdFromMediaName(remoteMediaName)
    : undefined;

  const remoteBackupStatus: BackupCdnInfoType = remoteMediaId
    ? await getBackupCdnInfo(remoteMediaId.string)
    : { isInBackupTier: false };

  const isLocalBackup =
    backupOptions.type === 'local-encrypted' ||
    backupOptions.type === 'plaintext-export';
  filePointer.locatorInfo = getLocatorInfoForAttachment({
    attachment,
    backupOptions,
    isOnDisk: isAttachmentOnDisk,
    backupTierInfo: remoteBackupStatus,
  });

  if (isLocalBackup) {
    if (
      isAttachmentOnDisk &&
      hasRequiredInformationForLocalBackup(attachment)
    ) {
      return {
        filePointer,
        backupJob: {
          isPlaintextExport: backupOptions.type === 'plaintext-export',
          mediaName: getLocalBackupFileNameForAttachment(attachment),
          type: 'local',
          data: {
            contentType: attachment.contentType,
            fileName: attachment.fileName,
            localKey: attachment.localKey,
            path: attachment.path,
            size: attachment.size,
          },
        },
      };
    }
    return {
      filePointer,
      backupJob: undefined,
    };
  }

  if (backupOptions.level !== BackupLevel.Paid) {
    return { filePointer, backupJob: undefined };
  }

  if (remoteBackupStatus.isInBackupTier) {
    return { filePointer, backupJob: undefined };
  }

  if (!isAttachmentOnDisk) {
    return { filePointer, backupJob: undefined };
  }

  if (!remoteMediaName) {
    return { filePointer, backupJob: undefined };
  }

  const { path, localKey, key, version } = attachment;

  strictAssert(path, 'Path must exist for attachment on disk');
  strictAssert(key, 'Key must exist for remote backupable attachment');

  const { transitCdnKey, transitCdnNumber, transitTierUploadTimestamp } =
    filePointer.locatorInfo;

  return {
    filePointer,
    backupJob: {
      mediaName: remoteMediaName,
      receivedAt: messageReceivedAt,
      type: 'standard',
      data: {
        path,
        localKey,
        version,
        contentType: attachment.contentType,
        keys: key,
        size: attachment.size,
        transitCdnInfo:
          transitCdnKey && transitCdnNumber != null
            ? {
                cdnKey: transitCdnKey,
                cdnNumber: transitCdnNumber,
                uploadTimestamp:
                  toNumber(transitTierUploadTimestamp) ?? undefined,
              }
            : undefined,
      },
    },
  };
}

function maybeFixupAttachment(attachment: AttachmentType): AttachmentType {
  // Fixup attachment which has plaintextHash but no key
  if (
    isValidPlaintextHash(attachment.plaintextHash) &&
    !isValidAttachmentKey(attachment.key)
  ) {
    const fixedUpAttachment = { ...attachment };
    fixedUpAttachment.key = Bytes.toBase64(generateAttachmentKeys());
    // Delete all info dependent on key
    delete fixedUpAttachment.cdnKey;
    delete fixedUpAttachment.cdnNumber;
    delete fixedUpAttachment.uploadTimestamp;
    delete fixedUpAttachment.digest;
    delete fixedUpAttachment.backupCdnNumber;

    strictAssert(
      hasRequiredInformationForRemoteBackup(fixedUpAttachment),
      'should be backupable with new key'
    );
    return fixedUpAttachment;
  }
  return attachment;
}
function getLocatorInfoForAttachment({
  attachment,
  backupOptions,
  isOnDisk,
  backupTierInfo,
}: {
  attachment: AttachmentType;
  backupOptions: BackupExportOptions;
  isOnDisk: boolean;
  backupTierInfo: BackupCdnInfoType;
}): Backups.FilePointer.LocatorInfo.Params {
  const isLocalBackup =
    backupOptions.type === 'local-encrypted' ||
    backupOptions.type === 'plaintext-export';

  const shouldBeLocallyBackedUp =
    isLocalBackup &&
    isOnDisk &&
    hasRequiredInformationForLocalBackup(attachment);

  const isDownloadableFromTransitTier =
    hasRequiredInformationToDownloadFromTransitTier(attachment);

  if (
    !shouldBeLocallyBackedUp &&
    !isDownloadableFromTransitTier &&
    !hasRequiredInformationForRemoteBackup(attachment)
  ) {
    return {
      size: null,
      key: null,
      integrityCheck: null,
      transitCdnKey: null,
      transitCdnNumber: null,
      transitTierUploadTimestamp: null,
      localKey: null,
      mediaTierCdnNumber: null,
    };
  }

  let integrityCheck: Backups.FilePointer.LocatorInfo.Params['integrityCheck'];
  if (isValidPlaintextHash(attachment.plaintextHash)) {
    integrityCheck = {
      plaintextHash: Bytes.fromHex(attachment.plaintextHash),
    };
  } else if (isValidDigest(attachment.digest)) {
    integrityCheck = {
      encryptedDigest: Bytes.fromBase64(attachment.digest),
    };
  } else {
    integrityCheck = null;
  }

  let mediaTierCdnNumber: Backups.FilePointer.LocatorInfo.Params['mediaTierCdnNumber'];

  if (backupTierInfo.isInBackupTier && backupTierInfo.cdnNumber != null) {
    mediaTierCdnNumber = backupTierInfo.cdnNumber;
  } else if (backupOptions.type === 'cross-client-integration-test') {
    mediaTierCdnNumber = attachment.backupCdnNumber ?? null;
  } else {
    mediaTierCdnNumber = null;
  }

  return {
    size: attachment.size,
    key: isValidAttachmentKey(attachment.key)
      ? Bytes.fromBase64(attachment.key)
      : null,
    integrityCheck,

    ...(isDownloadableFromTransitTier
      ? {
          transitCdnKey: attachment.cdnKey,
          transitCdnNumber: attachment.cdnNumber,
          transitTierUploadTimestamp: getSafeLongFromTimestamp(
            attachment.uploadTimestamp
          ),
        }
      : {
          transitCdnKey: null,
          transitCdnNumber: null,
          transitTierUploadTimestamp: null,
        }),
    localKey: shouldBeLocallyBackedUp
      ? Bytes.fromBase64(attachment.localKey)
      : null,
    mediaTierCdnNumber,
  };
}
