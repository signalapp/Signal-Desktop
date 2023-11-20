// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createWriteStream, existsSync, unlinkSync } from 'fs';
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
import {
  getFirstBytes,
  decryptAttachmentV1,
  getAttachmentSizeBucket,
} from '../Crypto';
import {
  decryptAttachmentV2,
  IV_LENGTH,
  ATTACHMENT_MAC_LENGTH,
} from '../AttachmentCrypto';

import type { ProcessedAttachment } from './Types.d';
import type { WebAPIType } from './WebAPI';
import { createName, getRelativePath } from '../windows/attachments';

export async function downloadAttachmentV1(
  server: WebAPIType,
  attachment: ProcessedAttachment,
  options?: {
    disableRetries?: boolean;
    timeout?: number;
  }
): Promise<DownloadedAttachmentType> {
  const cdnId = attachment.cdnId || attachment.cdnKey;
  const { cdnNumber } = attachment;

  if (!cdnId) {
    throw new Error('downloadAttachment: Attachment was missing cdnId!');
  }

  const encrypted = await server.getAttachment(
    cdnId,
    dropNull(cdnNumber),
    options
  );
  const { key, digest, size, contentType } = attachment;

  if (!digest) {
    throw new Error('Failure: Ask sender to update Signal and resend.');
  }

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
  const { cdnId, cdnKey, cdnNumber, contentType, digest, key, size } =
    attachment;

  const cdn = cdnId || cdnKey;
  const logId = `downloadAttachmentV2(${cdn}):`;

  strictAssert(cdn, `${logId}: missing cdnId or cdnKey`);
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

  if (existsSync(cipherTextAbsolutePath)) {
    unlinkSync(cipherTextAbsolutePath);
  }

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

  const targetSize =
    getAttachmentSizeBucket(size) * 1.05 + IV_LENGTH + ATTACHMENT_MAC_LENGTH;
  const checkSizeTransform = new CheckSizeTransform(targetSize);

  try {
    await pipeline(downloadStream, checkSizeTransform, writeStream);
  } catch (error) {
    try {
      writeStream.close();
      if (absoluteTargetPath && existsSync(absoluteTargetPath)) {
        unlinkSync(absoluteTargetPath);
      }
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
class CheckSizeTransform extends Transform {
  private bytesSeen = 0;

  constructor(private maxBytes: number) {
    super();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      this.bytesSeen += chunk.byteLength;

      if (this.bytesSeen > this.maxBytes) {
        done(
          new AttachmentSizeError(
            `CheckSizeTransform: Saw ${this.bytesSeen} bytes, max is ${this.maxBytes} bytes`
          )
        );
        return;
      }

      this.push(chunk);
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}
