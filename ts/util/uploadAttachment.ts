// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createReadStream } from 'fs';
import type {
  AttachmentWithHydratedData,
  UploadedAttachmentType,
} from '../types/Attachment';
import { MIMETypeToString, supportsIncrementalMac } from '../types/MIME';
import { getRandomBytes } from '../Crypto';
import { strictAssert } from './assert';
import { backupsService } from '../services/backups';
import { tusUpload } from './uploads/tusProtocol';
import { defaultFileReader } from './uploads/uploads';
import type { AttachmentUploadFormResponseType } from '../textsecure/WebAPI';
import {
  type EncryptedAttachmentV2,
  encryptAttachmentV2ToDisk,
  safeUnlink,
  type PlaintextSourceType,
  type HardcodedIVForEncryptionType,
} from '../AttachmentCrypto';
import { missingCaseError } from './missingCaseError';
import { uuidToBytes } from './uuidToBytes';

const CDNS_SUPPORTING_TUS = new Set([3]);

export async function uploadAttachment(
  attachment: AttachmentWithHydratedData
): Promise<UploadedAttachmentType> {
  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI must be initialized');

  const keys = getRandomBytes(64);
  const needIncrementalMac = supportsIncrementalMac(attachment.contentType);

  const { cdnKey, cdnNumber, encrypted } = await encryptAndUploadAttachment({
    keys,
    needIncrementalMac,
    plaintext: { data: attachment.data },
    uploadType: 'standard',
  });

  const { blurHash, caption, clientUuid, fileName, flags, height, width } =
    attachment;

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
  dangerousIv,
  keys,
  needIncrementalMac,
  plaintext,
  uploadType,
}: {
  dangerousIv?: HardcodedIVForEncryptionType;
  keys: Uint8Array;
  needIncrementalMac: boolean;
  plaintext: PlaintextSourceType;
  uploadType: 'standard' | 'backup';
}): Promise<{
  cdnKey: string;
  cdnNumber: number;
  encrypted: EncryptedAttachmentV2;
}> {
  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI must be initialized');

  let uploadForm: AttachmentUploadFormResponseType;
  let absoluteCiphertextPath: string | undefined;

  try {
    switch (uploadType) {
      case 'standard':
        uploadForm = await server.getAttachmentUploadForm();
        break;
      case 'backup':
        uploadForm = await backupsService.api.getMediaUploadForm();
        break;
      default:
        throw missingCaseError(uploadType);
    }

    const encrypted = await encryptAttachmentV2ToDisk({
      dangerousIv,
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
  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI must be initialized');

  if (CDNS_SUPPORTING_TUS.has(uploadForm.cdn)) {
    const fetchFn = server.createFetchForAttachmentUpload(uploadForm);
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
    await server.putEncryptedAttachment(
      (start, end) => createReadStream(absoluteCiphertextPath, { start, end }),
      ciphertextFileSize,
      uploadForm
    );
  }
}
