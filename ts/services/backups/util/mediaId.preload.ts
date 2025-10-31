// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../../../sql/Client.preload.js';
import * as Bytes from '../../../Bytes.std.js';
import { getBackupMediaRootKey } from '../crypto.preload.js';
import type {
  BackupableAttachmentType,
  AttachmentReadyForLocalBackup,
} from '../../../types/Attachment.std.js';
import { sha256 } from '../../../Crypto.node.js';

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

export function getMediaIdForAttachment(attachment: BackupableAttachmentType): {
  string: string;
  bytes: Uint8Array;
} {
  const mediaName = getMediaNameForAttachment(attachment);
  return getMediaIdFromMediaName(mediaName);
}

export function getMediaIdForAttachmentThumbnail(
  attachment: BackupableAttachmentType
): {
  string: string;
  bytes: Uint8Array;
} {
  const mediaName = getMediaNameForAttachmentThumbnail(
    getMediaNameForAttachment(attachment)
  );
  return getMediaIdFromMediaName(mediaName);
}

export function getMediaNameForAttachment(
  attachment: BackupableAttachmentType
): string {
  return getMediaName({
    plaintextHash: Bytes.fromHex(attachment.plaintextHash),
    key: Bytes.fromBase64(attachment.key),
  });
}

export function getMediaName({
  plaintextHash,
  key,
}: {
  plaintextHash: Uint8Array;
  key: Uint8Array;
}): string {
  return Bytes.toHex(Bytes.concatenate([plaintextHash, key]));
}

export function getLocalBackupFileNameForAttachment(
  attachment: AttachmentReadyForLocalBackup
): string {
  return getLocalBackupFileName({
    plaintextHash: Bytes.fromHex(attachment.plaintextHash),
    localKey: Bytes.fromBase64(attachment.localKey),
  });
}

export function getLocalBackupFileName({
  plaintextHash,
  localKey,
}: {
  plaintextHash: Uint8Array;
  localKey: Uint8Array;
}): string {
  return Bytes.toHex(sha256(Bytes.concatenate([plaintextHash, localKey])));
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
