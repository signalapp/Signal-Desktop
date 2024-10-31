// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../../../sql/Client';
import * as Bytes from '../../../Bytes';
import { getBackupMediaRootKey } from '../crypto';
import type { AttachmentType } from '../../../types/Attachment';
import { strictAssert } from '../../../util/assert';

export function getMediaIdFromMediaName(mediaName: string): {
  string: string;
  bytes: Uint8Array;
} {
  const mediaIdBytes = getBackupMediaRootKey().deriveMediaId(mediaName);
  return {
    string: Bytes.toBase64url(mediaIdBytes),
    bytes: mediaIdBytes,
  };
}

export function getMediaIdForAttachment(attachment: AttachmentType): {
  string: string;
  bytes: Uint8Array;
} {
  const mediaName = getMediaNameForAttachment(attachment);
  return getMediaIdFromMediaName(mediaName);
}

export function getMediaIdForAttachmentThumbnail(attachment: AttachmentType): {
  string: string;
  bytes: Uint8Array;
} {
  const mediaName = getMediaNameForAttachmentThumbnail(
    getMediaNameForAttachment(attachment)
  );
  return getMediaIdFromMediaName(mediaName);
}

export function getMediaNameForAttachment(attachment: AttachmentType): string {
  if (attachment.backupLocator) {
    return attachment.backupLocator.mediaName;
  }
  strictAssert(attachment.digest, 'Digest must be present');
  return getMediaNameFromDigest(attachment.digest);
}

export function getMediaNameFromDigest(digest: string): string {
  return Bytes.toHex(Bytes.fromBase64(digest));
}

export function getMediaNameForAttachmentThumbnail(
  fullsizeMediaName: string
): `${string}_thumbnail` {
  return `${fullsizeMediaName}_thumbnail`;
}

export function getBytesFromMediaIdString(mediaId: string): Uint8Array {
  return Bytes.fromBase64url(mediaId);
}

export type BackupCdnInfoType =
  | { isInBackupTier: true; cdnNumber: number }
  | { isInBackupTier: false };

export type GetBackupCdnInfoType = (
  mediaId: string
) => Promise<BackupCdnInfoType>;

export const getBackupCdnInfo: GetBackupCdnInfoType = async (
  mediaId: string
) => {
  const savedInfo = await DataReader.getBackupCdnObjectMetadata(mediaId);
  if (!savedInfo) {
    return { isInBackupTier: false };
  }

  return { isInBackupTier: true, cdnNumber: savedInfo.cdnNumber };
};
