// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { createReadStream } from 'node:fs';
import type {
  AttachmentWithHydratedData,
  UploadedAttachmentType,
} from '../types/Attachment.js';
import { MIMETypeToString, supportsIncrementalMac } from '../types/MIME.js';
import { getRandomBytes } from '../Crypto.js';
import { backupsService } from '../services/backups/index.js';
import { tusUpload } from './uploads/tusProtocol.js';
import { defaultFileReader } from './uploads/uploads.js';
import {
  type AttachmentUploadFormResponseType,
  getAttachmentUploadForm,
  createFetchForAttachmentUpload,
  putEncryptedAttachment,
} from '../textsecure/WebAPI.js';
import {
  type EncryptedAttachmentV2,
  encryptAttachmentV2ToDisk,
  safeUnlink,
  type PlaintextSourceType,
} from '../AttachmentCrypto.js';
import { missingCaseError } from './missingCaseError.js';
import { uuidToBytes } from './uuidToBytes.js';
import { isVisualMedia } from './Attachment.js';

const CDNS_SUPPORTING_TUS = new Set([3]);

export async function uploadAttachment(
  attachment: AttachmentWithHydratedData
): Promise<UploadedAttachmentType> {
  const keys = getRandomBytes(64);
  const needIncrementalMac = supportsIncrementalMac(attachment.contentType);

  const uploadTimestamp = Date.now();
  const { cdnKey, cdnNumber, encrypted } = await encryptAndUploadAttachment({
    keys,
    needIncrementalMac,
    plaintext: { data: attachment.data },
    uploadType: 'standard',
  });

  const { blurHash, caption, clientUuid, flags, height, width } = attachment;

  // Strip filename for visual media (images and videos) to prevent metadata leakage
  const fileName = isVisualMedia(attachment) ? undefined : attachment.fileName;

  return {
    cdnKey,
    cdnNumber,
    clientUuid: clientUuid ? uuidToBytes(clientUuid) : undefined,
    key: keys,
    iv: encrypted.iv,
    size: attachment.data.byteLength,
    digest: encrypted.digest,
    plaintextHash: encrypted.plaintextHash,
    incrementalMac: encrypted.incrementalMac,
    chunkSize: encrypted.chunkSize,
    uploadTimestamp: Long.fromNumber(uploadTimestamp),

    contentType: MIMETypeToString(attachment.contentType),
    fileName,
    flags,
    width,
    height,
    caption,
    blurHash,
    isReencryptableToSameDigest: true,
  };
}

export async function encryptAndUploadAttachment({
  keys,
  needIncrementalMac,
  plaintext,
  uploadType,
}: {
  keys: Uint8Array;
  needIncrementalMac: boolean;
  plaintext: PlaintextSourceType;
  uploadType: 'standard' | 'backup';
}): Promise<{
  cdnKey: string;
  cdnNumber: number;
  encrypted: EncryptedAttachmentV2;
}> {
  let uploadForm: AttachmentUploadFormResponseType;
  let absoluteCiphertextPath: string | undefined;

  try {
    switch (uploadType) {
      case 'standard':
        uploadForm = await getAttachmentUploadForm();
        break;
      case 'backup':
        uploadForm = await backupsService.api.getMediaUploadForm();
        break;
      default:
        throw missingCaseError(uploadType);
    }

    const encrypted = await encryptAttachmentV2ToDisk({
      getAbsoluteAttachmentPath:
        window.Signal.Migrations.getAbsoluteAttachmentPath,
      keys,
      needIncrementalMac,
      plaintext,
    });

    absoluteCiphertextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
      encrypted.path
    );

    await uploadFile({
      absoluteCiphertextPath,
      ciphertextFileSize: encrypted.ciphertextSize,
      uploadForm,
    });

    return { cdnKey: uploadForm.key, cdnNumber: uploadForm.cdn, encrypted };
  } finally {
    if (absoluteCiphertextPath) {
      await safeUnlink(absoluteCiphertextPath);
    }
  }
}

export async function uploadFile({
  absoluteCiphertextPath,
  ciphertextFileSize,
  uploadForm,
}: {
  absoluteCiphertextPath: string;
  ciphertextFileSize: number;
  uploadForm: AttachmentUploadFormResponseType;
}): Promise<void> {
  if (CDNS_SUPPORTING_TUS.has(uploadForm.cdn)) {
    const fetchFn = createFetchForAttachmentUpload(uploadForm);
    await tusUpload({
      endpoint: uploadForm.signedUploadLocation,
      // the upload form headers are already included in the created fetch function
      headers: {},
      fileName: uploadForm.key,
      filePath: absoluteCiphertextPath,
      fileSize: ciphertextFileSize,
      reader: defaultFileReader,
      fetchFn,
    });
  } else {
    await putEncryptedAttachment(
      (start, end) => createReadStream(absoluteCiphertextPath, { start, end }),
      ciphertextFileSize,
      uploadForm
    );
  }
}
