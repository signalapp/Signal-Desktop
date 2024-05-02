// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  APPLICATION_OCTET_STREAM,
  stringToMIMEType,
} from '../../../types/MIME';
import type { AttachmentType } from '../../../types/Attachment';
import type { Backups } from '../../../protobuf';
import * as Bytes from '../../../Bytes';
import { getTimestampFromLong } from '../../../util/timestampLongUtils';

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
