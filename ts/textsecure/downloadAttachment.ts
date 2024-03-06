// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createWriteStream } from 'fs';
import { isNumber, omit } from 'lodash';
import type { Readable } from 'stream';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { ensureFile } from 'fs-extra';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { strictAssert } from '../util/assert';
import { dropNull } from '../util/dropNull';
import {
  AttachmentSizeError,
  type AttachmentType,
  type DownloadedAttachmentType,
} from '../types/Attachment';
import * as MIME from '../types/MIME';
import * as Bytes from '../Bytes';
import { getFirstBytes, decryptAttachmentV1 } from '../Crypto';
import {
  decryptAttachmentV2,
  getAttachmentDownloadSize,
  safeUnlinkSync,
} from '../AttachmentCrypto';
import type { ProcessedAttachment } from './Types.d';
import type { WebAPIType } from './WebAPI';
import { createName, getRelativePath } from '../windows/attachments';

export function getCdn(attachment: ProcessedAttachment): string {
  const { cdnId, cdnKey } = attachment;
  const cdn = cdnId || cdnKey;
  strictAssert(cdn, 'Attachment was missing cdnId or cdnKey');
  return cdn;
}

export async function downloadAttachmentV1(
  server: WebAPIType,
  attachment: ProcessedAttachment,
  options?: {
    disableRetries?: boolean;
    timeout?: number;
  }
): Promise<DownloadedAttachmentType> {
  const { cdnNumber, key, digest, size, contentType } = attachment;
  const cdn = getCdn(attachment);

  const encrypted = await server.getAttachment(
    cdn,
    dropNull(cdnNumber),
    options
  );

  strictAssert(digest, 'Failure: Ask sender to update Signal and resend.');
  strictAssert(key, 'attachment has no key');

  const paddedData = decryptAttachmentV1(
    encrypted,
    Bytes.fromBase64(key),
    Bytes.fromBase64(digest)
  );

  if (!isNumber(size)) {
    throw new Error(
      `downloadAttachment: Size was not provided, actual size was ${paddedData.byteLength}`
    );
  }

  const data = getFirstBytes(paddedData, size);

  return {
    ...attachment,
    size,
    contentType: contentType
      ? MIME.stringToMIMEType(contentType)
      : MIME.APPLICATION_OCTET_STREAM,
    data,
  };
}

export async function downloadAttachmentV2(
  server: WebAPIType,
  attachment: ProcessedAttachment,
  options?: {
    disableRetries?: boolean;
    timeout?: number;
  }
): Promise<AttachmentType> {
  const { cdnNumber, contentType, digest, key, size } = attachment;
  const cdn = getCdn(attachment);
  const logId = `downloadAttachmentV2(${cdn}):`;

  strictAssert(digest, `${logId}: missing digest`);
  strictAssert(key, `${logId}: missing key`);
  strictAssert(isNumber(size), `${logId}: missing size`);

  const downloadStream = await server.getAttachmentV2(
    cdn,
    dropNull(cdnNumber),
    options
  );

  const cipherTextRelativePath = await downloadToDisk({ downloadStream, size });
  const cipherTextAbsolutePath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(cipherTextRelativePath);

  const { path, plaintextHash } = await decryptAttachmentV2({
    ciphertextPath: cipherTextAbsolutePath,
    id: cdn,
    keys: Bytes.fromBase64(key),
    size,
    theirDigest: Bytes.fromBase64(digest),
  });

  safeUnlinkSync(cipherTextAbsolutePath);

  return {
    ...omit(attachment, 'key'),
    path,
    size,
    contentType: contentType
      ? MIME.stringToMIMEType(contentType)
      : MIME.APPLICATION_OCTET_STREAM,
    plaintextHash,
  };
}

async function downloadToDisk({
  downloadStream,
  size,
}: {
  downloadStream: Readable;
  size: number;
}): Promise<string> {
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);
  await ensureFile(absoluteTargetPath);
  const writeStream = createWriteStream(absoluteTargetPath);
  const targetSize = getAttachmentDownloadSize(size);

  try {
    await pipeline(downloadStream, checkSize(targetSize), writeStream);
  } catch (error) {
    try {
      safeUnlinkSync(absoluteTargetPath);
    } catch (cleanupError) {
      log.error(
        'downloadToDisk: Error while cleaning up',
        Errors.toLogFormat(cleanupError)
      );
    }

    throw error;
  }

  return relativeTargetPath;
}

// A simple transform that throws if it sees more than maxBytes on the stream.
function checkSize(expectedBytes: number) {
  let totalBytes = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      totalBytes += chunk.byteLength;
      if (totalBytes > expectedBytes) {
        callback(
          new AttachmentSizeError(
            `checkSize: Received ${totalBytes} bytes, max is ${expectedBytes}, `
          )
        );
        return;
      }
      this.push(chunk, encoding);
      callback();
    },
  });
}
