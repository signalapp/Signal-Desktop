// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';
import { PassThrough } from 'node:stream';

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
import { decryptAttachmentV2ToSink } from '../AttachmentCrypto.node.ts';
import {
  maybeDeleteAttachmentFile,
  writeNewAttachmentData,
  getAbsoluteAttachmentPath,
  getUnusedFilename,
  saveAttachmentToDisk,
} from './migrations.preload.ts';
import { toNumber } from './toNumber.std.ts';
import { getExistingAttachmentDataForReuse } from './attachments/deduplicateAttachment.preload.ts';
import { strictAssert } from './assert.std.ts';
import { getSuggestedFilename } from './Attachment.std.ts';

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

export async function saveAttachment({
  attachment,
  index,
  timestamp,
  baseDir,
}: {
  attachment: AttachmentType;
  index?: number;
  timestamp?: number;
  /**
   * Base directory for saving the attachment.
   * If omitted, a dialog will be opened to let the user choose a directory
   */
  baseDir?: string;
}): Promise<string | null> {
  strictAssert(attachment.path != null, 'Attachment must be on disk');
  strictAssert(attachment.localKey != null, 'Attachment must be encrypted');

  const suggestedFilename = getSuggestedFilename({
    attachment,
    timestamp,
    index,
  });

  /**
   * When baseDir is provided, saveAttachmentToDisk() will save without prompting
   * and may overwrite existing files, so we need to append a suffix
   */
  const name = getUnusedFilename({ filename: suggestedFilename, baseDir });

  const pipe = new PassThrough();

  try {
    const [result] = await Promise.all([
      saveAttachmentToDisk({
        data: { type: 'stream', stream: pipe },
        name,
        baseDir,
      }),
      decryptAttachmentV2ToSink(
        {
          idForLogging: `Attachment.save(${attachment.clientUuid})`,
          size: attachment.size,
          ciphertextPath: getAbsoluteAttachmentPath(attachment.path),
          type: 'local',
          keysBase64: attachment.localKey,
        },
        pipe
      ),
    ]);

    if (!result) {
      return null;
    }

    return result.fullPath;
  } catch (error) {
    if (error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}
