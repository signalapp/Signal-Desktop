// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createReadStream } from 'fs';
import type {
  AttachmentWithHydratedData,
  UploadedAttachmentType,
} from '../types/Attachment';
import { MIMETypeToString } from '../types/MIME';
import { getRandomBytes } from '../Crypto';
import { strictAssert } from './assert';
import { backupsService } from '../services/backups';
import { tusUpload } from './uploads/tusProtocol';
import { defaultFileReader } from './uploads/uploads';
import type { AttachmentV3ResponseType } from '../textsecure/WebAPI';
import {
  type EncryptedAttachmentV2,
  encryptAttachmentV2ToDisk,
  safeUnlinkSync,
  type PlaintextSourceType,
  type HardcodedIVForEncryptionType,
} from '../AttachmentCrypto';
import { missingCaseError } from './missingCaseError';

const CDNS_SUPPORTING_TUS = new Set([3]);

export async function uploadAttachment(
  attachment: AttachmentWithHydratedData
): Promise<UploadedAttachmentType> {
  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI must be initialized');

  const keys = getRandomBytes(64);

  const { cdnKey, cdnNumber, encrypted } = await encryptAndUploadAttachment({
    plaintext: { data: attachment.data },
    keys,
    uploadType: 'standard',
  });

  return {
    cdnKey,
    cdnNumber,
    key: keys,
    iv: encrypted.iv,
    size: attachment.data.byteLength,
    digest: encrypted.digest,
    plaintextHash: encrypted.plaintextHash,

    contentType: MIMETypeToString(attachment.contentType),
    fileName: attachment.fileName,
    flags: attachment.flags,
    width: attachment.width,
    height: attachment.height,
    caption: attachment.caption,
    blurHash: attachment.blurHash,
  };
}

export async function encryptAndUploadAttachment({
  plaintext,
  keys,
  dangerousIv,
  uploadType,
}: {
  plaintext: PlaintextSourceType;
  keys: Uint8Array;
  dangerousIv?: HardcodedIVForEncryptionType;
  uploadType: 'standard' | 'backup';
}): Promise<{
  cdnKey: string;
  cdnNumber: number;
  encrypted: EncryptedAttachmentV2;
}> {
  const { server } = window.textsecure;
  strictAssert(server, 'WebAPI must be initialized');

  let uploadForm: AttachmentV3ResponseType;
  let absoluteCiphertextPath: string | undefined;

  try {
    switch (uploadType) {
      case 'standard':
        uploadForm = await server.getAttachmentUploadForm();
        break;
      case 'backup':
        uploadForm = await server.getBackupMediaUploadForm(
          await backupsService.credentials.getHeadersForToday()
        );
        break;
      default:
        throw missingCaseError(uploadType);
    }

    const encrypted = await encryptAttachmentV2ToDisk({
      plaintext,
      keys,
      dangerousIv,
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
      safeUnlinkSync(absoluteCiphertextPath);
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
  uploadForm: AttachmentV3ResponseType;
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
      createReadStream(absoluteCiphertextPath),
      uploadForm
    );
  }
}
