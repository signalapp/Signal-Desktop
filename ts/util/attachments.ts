// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';

import * as log from '../logging/log';
import { scaleImageToLevel } from './scaleImageToLevel';
import { dropNull } from './dropNull';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl';
import type {
  AttachmentType,
  UploadedAttachmentType,
} from '../types/Attachment';
import { canBeTranscoded } from '../types/Attachment';
import * as Errors from '../types/errors';
import * as Bytes from '../Bytes';

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

  let scaleTarget: string | Blob;
  const { data, path, size } = attachment;

  if (data) {
    scaleTarget = new Blob([data], {
      type: attachment.contentType,
    });
  } else {
    if (!path) {
      return attachment;
    }
    scaleTarget = getLocalAttachmentUrl(attachment);
  }

  try {
    const { blob: xcodedDataBlob } = await scaleImageToLevel({
      fileOrBlobOrURL: scaleTarget,
      contentType: attachment.contentType,
      size,
      highQuality: false,
    });
    const xcodedDataArrayBuffer = await blobToArrayBuffer(xcodedDataBlob);

    // IMPORTANT: We overwrite the existing `data` `Uint8Array` losing the original
    // image data. Ideally, we’d preserve the original image data for users who want to
    // retain it but due to reports of data loss, we don’t want to overburden IndexedDB
    // by potentially doubling stored image data.
    // See: https://github.com/signalapp/Signal-Desktop/issues/1589
    // We also clear out the attachment path because we're changing
    // the attachment data so it no longer matches the old path.
    // Path and data should always be in agreement.
    const xcodedAttachment = {
      ...attachment,
      data: new Uint8Array(xcodedDataArrayBuffer),
      size: xcodedDataArrayBuffer.byteLength,
      path: undefined,
    };

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
>;

export function copyCdnFields(
  uploaded?: UploadedAttachmentType
): CdnFieldsType {
  if (!uploaded) {
    return {};
  }
  return {
    cdnId: dropNull(uploaded.cdnId)?.toString(),
    cdnKey: uploaded.cdnKey,
    cdnNumber: dropNull(uploaded.cdnNumber),
    digest: Bytes.toBase64(uploaded.digest),
    incrementalMac: uploaded.incrementalMac
      ? Bytes.toBase64(uploaded.incrementalMac)
      : undefined,
    chunkSize: dropNull(uploaded.chunkSize),
    isReencryptableToSameDigest: uploaded.isReencryptableToSameDigest,
    iv: Bytes.toBase64(uploaded.iv),
    key: Bytes.toBase64(uploaded.key),
    plaintextHash: uploaded.plaintextHash,
  };
}
