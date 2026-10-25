// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';

import { createLogger } from '../logging/log.std.ts';
import { scaleImageToLevel } from './scaleImageToLevel.preload.ts';
import { dropNull } from './dropNull.std.ts';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.ts';
import type {
  AttachmentType,
  UploadedAttachmentType,
} from '../types/Attachment.std.ts';
import { canBeTranscoded } from './Attachment.std.ts';
import * as Errors from '../types/errors.std.ts';
import * as Bytes from '../Bytes.std.ts';
import { sha256 } from '../Crypto.node.ts';
import {
  maybeDeleteAttachmentFile,
  writeNewAttachmentData,
} from './migrations.preload.ts';
import { toNumber } from './toNumber.std.ts';
import { getExistingAttachmentDataForReuse } from './attachments/deduplicateAttachment.preload.ts';

const log = createLogger('attachments');

// All outgoing images go through handleImageAttachment before being sent and thus have
// already been scaled to high-quality level, stripped of exif data, and saved. This
// should be called just before message send to downscale the attachment further if
// needed.
export const downscaleOutgoingAttachment = async (
  attachment: AttachmentType
): Promise<AttachmentType> => {
  if (!canBeTranscoded(attachment)) {
    return attachment;
  }

  const { path, size } = attachment;

  if (!path) {
    return attachment;
  }
  const scaleTarget = getLocalAttachmentUrl(attachment);

  try {
    const { blob: xcodedDataBlob } = await scaleImageToLevel({
      fileOrBlobOrURL: scaleTarget,
      contentType: attachment.contentType,
      size,
      highQuality: false,
    });
    const xcodedData = new Uint8Array(await blobToArrayBuffer(xcodedDataBlob));
    const plaintextHash = Bytes.toHex(sha256(xcodedData));

    const existing = await getExistingAttachmentDataForReuse({
      plaintextHash,
      contentType: attachment.contentType,
    });

    let xcodedAttachment: AttachmentType;
    if (existing == null) {
      xcodedAttachment = {
        ...attachment,
        ...(await writeNewAttachmentData(xcodedData)),
      };
    } else {
      xcodedAttachment = {
        ...attachment,
        size: xcodedData.byteLength,
        ...existing,
      };
    }

    // Delete old attachment
    await maybeDeleteAttachmentFile(path);

    return xcodedAttachment;
  } catch (error: unknown) {
    const errorString = Errors.toLogFormat(error);
    log.error(
      'downscaleOutgoingAttachment: Failed to scale attachment',
      errorString
    );

    return attachment;
  }
};

export type CdnFieldsType = Pick<
  AttachmentType,
  | 'cdnId'
  | 'cdnKey'
  | 'cdnNumber'
  | 'digest'
  | 'incrementalMac'
  | 'chunkSize'
  | 'isReencryptableToSameDigest'
  | 'iv'
  | 'key'
  | 'plaintextHash'
  | 'uploadTimestamp'
>;

export function copyCdnFields(
  uploaded?: UploadedAttachmentType
): CdnFieldsType {
  if (!uploaded) {
    return {};
  }
  return {
    cdnId: undefined,
    cdnKey: uploaded.attachmentIdentifier.cdnKey,
    cdnNumber: dropNull(uploaded.cdnNumber),
    digest: Bytes.toBase64(uploaded.digest),
    incrementalMac: uploaded.incrementalMac
      ? Bytes.toBase64(uploaded.incrementalMac)
      : undefined,
    chunkSize: dropNull(uploaded.chunkSize),
    key: Bytes.toBase64(uploaded.key),
    plaintextHash: uploaded.plaintextHash,
    uploadTimestamp: toNumber(uploaded.uploadTimestamp) ?? undefined,
  };
}
