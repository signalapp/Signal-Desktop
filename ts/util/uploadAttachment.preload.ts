// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Long from 'long';
import { createReadStream } from 'node:fs';
import type {
  AttachmentType,
  AttachmentWithHydratedData,
  UploadedAttachmentType,
} from '../types/Attachment.std.js';
import * as Bytes from '../Bytes.std.js';
import { createLogger } from '../logging/log.std.js';
import { MIMETypeToString, supportsIncrementalMac } from '../types/MIME.std.js';
import { getRandomBytes } from '../Crypto.node.js';
import { backupsService } from '../services/backups/index.preload.js';
import { tusUpload } from './uploads/tusProtocol.node.js';
import { defaultFileReader } from './uploads/uploads.node.js';
import {
  type AttachmentUploadFormResponseType,
  getAttachmentUploadForm,
  createFetchForAttachmentUpload,
  putEncryptedAttachment,
} from '../textsecure/WebAPI.preload.js';
import {
  type EncryptedAttachmentV2,
  encryptAttachmentV2ToDisk,
  safeUnlink,
  type PlaintextSourceType,
} from '../AttachmentCrypto.node.js';
import { missingCaseError } from './missingCaseError.std.js';
import { uuidToBytes } from './uuidToBytes.std.js';
import { DAY, HOUR } from './durations/index.std.js';
import { isImageAttachment, isVideoAttachment } from './Attachment.std.js';
import { getAbsoluteAttachmentPath } from './migrations.preload.js';
import { isMoreRecentThan } from './timestamp.std.js';
import { DataReader } from '../sql/Client.preload.js';
import {
  isValidAttachmentKey,
  isValidDigest,
  isValidPlaintextHash,
} from '../types/Crypto.std.js';
import type { ExistingAttachmentUploadData } from '../sql/Interface.std.js';

const CDNS_SUPPORTING_TUS = new Set([3]);
const MAX_DURATION_TO_REUSE_ATTACHMENT_CDN_POINTER = 3 * DAY;

const log = createLogger('uploadAttachment');

export async function uploadAttachment(
  attachment: AttachmentWithHydratedData
): Promise<UploadedAttachmentType> {
  let keys: Uint8Array;
  let cdnKey: string;
  let cdnNumber: number;
  let digest: Uint8Array;
  let plaintextHash: string;
  let incrementalMac: Uint8Array | undefined;
  let chunkSize: number | undefined;
  let uploadTimestamp: number;

  const needIncrementalMac = supportsIncrementalMac(attachment.contentType);
  const dataForReuse = await getAttachmentUploadDataForReuse(attachment);

  if (dataForReuse && isValidPlaintextHash(attachment.plaintextHash)) {
    log.info('reusing attachment uploaded at', dataForReuse.uploadTimestamp);

    ({ cdnKey, cdnNumber, uploadTimestamp } = dataForReuse);
    keys = Bytes.fromBase64(dataForReuse.key);

    digest = Bytes.fromBase64(dataForReuse.digest);
    plaintextHash = attachment.plaintextHash;
    incrementalMac =
      needIncrementalMac && dataForReuse.incrementalMac
        ? Bytes.fromBase64(dataForReuse.incrementalMac)
        : undefined;
    chunkSize =
      needIncrementalMac && dataForReuse.chunkSize
        ? dataForReuse.chunkSize
        : undefined;
  } else {
    keys = getRandomBytes(64);
    uploadTimestamp = Date.now();

    ({
      cdnKey,
      cdnNumber,
      encrypted: { digest, plaintextHash, incrementalMac, chunkSize },
    } = await encryptAndUploadAttachment({
      keys,
      needIncrementalMac,
      plaintext: { data: attachment.data },
      uploadType: 'standard',
    }));
  }

  const { blurHash, caption, clientUuid, flags, height, width } = attachment;

  // Strip filename only for renderable visual media to prevent metadata leakage
  const shouldStripFilename =
    isImageAttachment(attachment) || isVideoAttachment(attachment);
  const fileName = shouldStripFilename ? undefined : attachment.fileName;

  return {
    cdnKey,
    cdnNumber,
    clientUuid: clientUuid ? uuidToBytes(clientUuid) : undefined,
    key: keys,
    size: attachment.data.byteLength,
    digest,
    plaintextHash,
    incrementalMac,
    chunkSize,
    uploadTimestamp: Long.fromNumber(uploadTimestamp),

    contentType: MIMETypeToString(attachment.contentType),
    fileName,
    flags,
    width,
    height,
    caption,
    blurHash,
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
      getAbsoluteAttachmentPath,
      keys,
      needIncrementalMac,
      plaintext,
    });

    absoluteCiphertextPath = getAbsoluteAttachmentPath(encrypted.path);

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

async function getAttachmentUploadDataForReuse(
  attachment: AttachmentType
): Promise<ExistingAttachmentUploadData | null> {
  if (!isValidPlaintextHash(attachment.plaintextHash)) {
    return null;
  }

  if (isValidCdnDataForReuse(attachment)) {
    return {
      cdnKey: attachment.cdnKey,
      cdnNumber: attachment.cdnNumber,
      key: attachment.key,
      digest: attachment.digest,
      uploadTimestamp: attachment.uploadTimestamp,
      incrementalMac: attachment.incrementalMac ?? null,
      chunkSize: attachment.chunkSize ?? null,
    };
  }

  const recentAttachmentUploadData =
    await DataReader.getMostRecentAttachmentUploadData(
      attachment.plaintextHash
    );

  if (
    recentAttachmentUploadData &&
    isValidCdnDataForReuse(recentAttachmentUploadData)
  ) {
    return recentAttachmentUploadData;
  }

  return null;
}

function isValidCdnDataForReuse(attachment: {
  cdnKey?: string;
  cdnNumber?: number;
  digest?: string;
  key?: string;
  uploadTimestamp?: number;
}): attachment is {
  cdnKey: string;
  cdnNumber: number;
  digest: string;
  key: string;
  uploadTimestamp: number;
} {
  return Boolean(
    isValidDigest(attachment.digest) &&
    isValidAttachmentKey(attachment.key) &&
    attachment.cdnKey != null &&
    attachment.cdnNumber != null &&
    attachment.uploadTimestamp &&
    isMoreRecentThan(
      attachment.uploadTimestamp,
      MAX_DURATION_TO_REUSE_ATTACHMENT_CDN_POINTER
    ) &&
    // for extra safety, check to make sure we don't have an uploadTimestamp that's
    // incorrectly in the future
    attachment.uploadTimestamp < Date.now() + 12 * HOUR
  );
}
