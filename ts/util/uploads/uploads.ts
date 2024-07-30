// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import fetch from 'node-fetch';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { TusFileReader, FetchFunctionType } from './tusProtocol';
import { tusResumeUpload, tusUpload } from './tusProtocol';
import { HTTPError } from '../../textsecure/Errors';

export const defaultFileReader: TusFileReader = (filePath, offset) => {
  return createReadStream(filePath, { start: offset });
};

/**
 * @public
 * Uploads a file to the attachments bucket.
 * @throws {ResponseError} If the server responded with an error.
 */
export async function uploadAttachment({
  host,
  fileName,
  filePath,
  fileSize,
  checksum,
  headers = {},
  signal,
}: {
  host: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  checksum: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<void> {
  return tusUpload({
    endpoint: `${host}/upload/attachments`,
    headers: {
      ...headers,
      'X-Signal-Checksum-Sha256': checksum,
    },
    fileName,
    filePath,
    fileSize,
    reader: defaultFileReader,
    signal,
  });
}

/**
 * @public
 * Resumes an upload to the attachments bucket.
 * @throws {ResponseError} If the server responded with an error.
 */
export async function resumeUploadAttachment({
  host,
  fileName,
  filePath,
  fileSize,
  headers = {},
  signal,
}: {
  host: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<void> {
  return tusResumeUpload({
    endpoint: `${host}/upload/attachments`,
    headers,
    fileName,
    filePath,
    fileSize,
    reader: defaultFileReader,
    signal,
  });
}

/**
 * Downloads a file with Signal headers.
 * @throws {ResponseError} If the server responded with an error.
 * @throws {Error} If the response has no body.
 */
export async function _doDownload({
  endpoint,
  headers = {},
  filePath,
  signal,
  fetchFn = fetch,
}: {
  endpoint: string;
  filePath: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  fetchFn?: FetchFunctionType;
}): Promise<void> {
  const response = await fetchFn(endpoint, {
    method: 'GET',
    signal,
    redirect: 'error',
    headers,
  });
  if (!response.ok) {
    throw HTTPError.fromResponse(response);
  }
  if (!response.body) {
    throw new Error('Response has no body');
  }
  const writable = createWriteStream(filePath);
  await pipeline(response.body, writable);
}

/**
 * @public
 * Downloads a file from the attachments bucket.
 * @throws {ResponseError} If the server responded with an error.
 */
export async function downloadAttachment({
  host,
  fileName,
  filePath,
  headers,
  signal,
}: {
  host: string;
  fileName: string;
  filePath: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<void> {
  return _doDownload({
    endpoint: `${host}/attachments/${fileName}`,
    headers,
    filePath,
    signal,
  });
}
