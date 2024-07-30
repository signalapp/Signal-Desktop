// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type Readable } from 'node:stream';
import fetch, { type RequestInit, type Response } from 'node-fetch';

import { HTTPError } from '../../textsecure/Errors';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import { sleep } from '../sleep';
import { FIBONACCI_TIMEOUTS, BackOff } from '../BackOff';

export type FetchFunctionType = (
  url: string | URL,
  init: RequestInit
) => Promise<Response>;

const DEFAULT_MAX_RETRIES = 3;

function toLogId(input: string) {
  return Buffer.from(input).toString('base64').slice(0, 3);
}

function redactedUrl(endpoint: string) {
  const redacted = new URL(endpoint);
  redacted.search = '';
  redacted.pathname = '';
  return `${redacted}[REDACTED]`;
}

/**
 * This file is a standalone implementation of the TUS protocol.
 * Signal specific logic is in uploads.ts
 */

export type TusFileReader = (filePath: string, offset?: number) => Readable;

/**
 * @private
 * https://tus.io/protocols/resumable-upload#upload-metadata
 */
export function _getUploadMetadataHeader(
  params: Record<string, string>
): string {
  return Object.entries(params)
    .map(([key, value]) => {
      return `${key} ${Buffer.from(value).toString('base64')}`;
    })
    .join(',');
}

function addProgressHandler(
  readable: Readable,
  onProgress: (progress: number) => void
): void {
  let bytesUploaded = 0;
  // Explicitly stop the flow, otherwise we might emit 'data' before `fetch()`
  // starts reading the stream.
  readable.pause();
  readable.on('data', (chunk: Buffer) => {
    bytesUploaded += chunk.byteLength;
    onProgress(bytesUploaded);
  });
}

function wrapFetchWithBody(
  responsePromise: Promise<Response>,
  body: Readable
): Promise<Response> {
  const errorPromise = new Promise<Response>((_resolve, reject) => {
    body.on('error', reject);
  });

  return Promise.race([responsePromise, errorPromise]);
}

/**
 * @private
 * Generic TUS POST implementation with creation-with-upload.
 * @returns {boolean} `true` if the upload completed, `false` if interrupted.
 * @throws {ResponseError} If the server responded with an error.
 * @see https://tus.io/protocols/resumable-upload#creation-with-upload
 */
export async function _tusCreateWithUploadRequest({
  endpoint,
  headers,
  fileName,
  fileSize,
  readable,
  onProgress,
  onCaughtError,
  signal,
  fetchFn = fetch,
}: {
  endpoint: string;
  headers: Record<string, string>;
  fileName: string;
  fileSize: number;
  readable: Readable;
  onProgress?: (bytesUploaded: number) => void;
  onCaughtError?: (error: Error) => void;
  signal?: AbortSignal;
  fetchFn?: FetchFunctionType;
}): Promise<boolean> {
  const logId = `tusProtocol: CreateWithUpload(${toLogId(
    fileName
  )}): POST ${redactedUrl(endpoint)}`;

  if (onProgress != null) {
    addProgressHandler(readable, onProgress);
  }

  let response: Response;
  try {
    log.info(`${logId} init`);
    response = await wrapFetchWithBody(
      fetchFn(endpoint, {
        method: 'POST',
        signal,
        // @ts-expect-error: `duplex` is missing from TypeScript's `RequestInit`.
        duplex: 'half',
        headers: {
          ...headers,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(fileSize),
          'Upload-Metadata': _getUploadMetadataHeader({
            filename: fileName,
          }),
          'Content-Type': 'application/offset+octet-stream',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: readable as any,
      }),
      readable
    );
  } catch (error) {
    log.error(`${logId} closed without response`, Errors.toLogFormat(error));
    onCaughtError?.(error);
    return false;
  }
  if (!response.ok) {
    log.error(`${logId} error (${response.status})`);
    throw HTTPError.fromResponse(response);
  }
  log.info(`${logId} success (${response.status})`);
  return true;
}

function isPositiveInteger(value: number): value is number {
  return Number.isInteger(value) && value >= 0;
}

/**
 * @private
 * Generic TUS HEAD implementation.
 * @returns {number} The current offset of the upload.
 * @throws {ResponseError} If the server responded with an error.
 * @throws {Error} If the server responded with an invalid Upload-Offset header.
 * @see https://tus.io/protocols/resumable-upload#head
 */
export async function _tusGetCurrentOffsetRequest({
  endpoint,
  headers,
  fileName,
  signal,
  fetchFn = fetch,
}: {
  endpoint: string;
  headers: Record<string, string>;
  fileName: string;
  signal?: AbortSignal;
  fetchFn?: FetchFunctionType;
}): Promise<number> {
  const logId = `tusProtocol: GetCurrentOffsetRequest(${toLogId(
    fileName
  )}): HEAD ${redactedUrl(endpoint)}`;

  log.info(`${logId} init`);

  const response = await fetchFn(`${endpoint}/${fileName}`, {
    method: 'HEAD',
    signal,
    headers: {
      ...headers,
      'Tus-Resumable': '1.0.0',
    },
  });
  if (!response.ok) {
    log.error(`${logId} error (${response.status})`);
    throw HTTPError.fromResponse(response);
  }

  log.info(`${logId} success (${response.status})`);
  const header = response.headers.get('Upload-Offset');
  if (header == null) {
    throw new Error('getCurrentState: Missing Upload-Offset header');
  }

  const result = Number(header);
  if (!isPositiveInteger(result)) {
    throw new Error(`getCurrentState: Invalid Upload-Offset (${header})`);
  }

  log.info(`${logId} current offset (${result})`);
  return result;
}

/**
 * @private
 * Generic TUS PATCH implementation.
 * @returns {boolean} `true` if the upload completed, `false` if interrupted.
 * @throws {ResponseError} If the server responded with an error.
 * @see https://tus.io/protocols/resumable-upload#patch
 */
export async function _tusResumeUploadRequest({
  endpoint,
  headers,
  fileName,
  uploadOffset,
  readable,
  onProgress,
  onCaughtError,
  signal,
  fetchFn = fetch,
}: {
  endpoint: string;
  headers: Record<string, string>;
  fileName: string;
  uploadOffset: number;
  readable: Readable;
  onProgress?: (bytesUploaded: number) => void;
  onCaughtError?: (error: Error) => void;
  signal?: AbortSignal;
  fetchFn?: FetchFunctionType;
}): Promise<boolean> {
  const logId = `tusProtocol: ResumeUploadRequest(${toLogId(
    fileName
  )}): PATCH ${redactedUrl(endpoint)}`;
  if (onProgress != null) {
    addProgressHandler(readable, onProgress);
  }

  let response: Response;
  try {
    log.info(`${logId} init`);
    response = await wrapFetchWithBody(
      fetchFn(`${endpoint}/${fileName}`, {
        method: 'PATCH',
        signal,
        // @ts-expect-error: `duplex` is missing from TypeScript's `RequestInit`.
        duplex: 'half',
        headers: {
          ...headers,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(uploadOffset),
          'Content-Type': 'application/offset+octet-stream',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: readable as any,
      }),
      readable
    );
  } catch (error) {
    log.error(`${logId} closed without response`, Errors.toLogFormat(error));
    onCaughtError?.(error);
    return false;
  }
  if (!response.ok) {
    log.error(`${logId} error (${response.status})`);
    throw HTTPError.fromResponse(response);
  }
  log.info(`${logId} success (${response.status})`);
  return true;
}

/**
 * Attempts to upload a file using the TUS protocol with Signal headers, and
 * resumes the upload if it was interrupted.
 * @throws {ResponseError} If the server responded with an error.
 */
export async function tusUpload({
  endpoint,
  headers,
  fileName,
  filePath,
  fileSize,
  reader,
  onProgress,
  onCaughtError,
  maxRetries = DEFAULT_MAX_RETRIES,
  signal,
  fetchFn = fetch,
}: {
  endpoint: string;
  headers: Record<string, string>;
  fileName: string;
  filePath: string;
  fileSize: number;
  reader: TusFileReader;
  onProgress?: (bytesUploaded: number) => void;
  onCaughtError?: (error: Error) => void;
  maxRetries?: number;
  signal?: AbortSignal;
  fetchFn?: FetchFunctionType;
}): Promise<void> {
  const readable = reader(filePath);
  const done = await _tusCreateWithUploadRequest({
    endpoint,
    headers,
    fileName,
    fileSize,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readable: readable as any,
    onProgress,
    onCaughtError,
    signal,
    fetchFn,
  });
  if (!done) {
    await tusResumeUpload({
      endpoint,
      headers,
      fileName,
      filePath,
      fileSize,
      reader,
      onProgress,
      onCaughtError,
      maxRetries,
      signal,
      fetchFn,
    });
  }
}

const BACKOFF_JITTER_MS = 100;

/**
 * Attempts to resume an upload using the TUS protocol.
 * @throws {ResponseError} If the server responded with an error.
 * @param params
 */
export async function tusResumeUpload({
  endpoint,
  headers,
  fileName,
  filePath,
  fileSize,
  reader,
  onProgress,
  onCaughtError,
  maxRetries = DEFAULT_MAX_RETRIES,
  signal,
  fetchFn = fetch,
}: {
  endpoint: string;
  headers: Record<string, string>;
  fileName: string;
  filePath: string;
  fileSize: number;
  reader: TusFileReader;
  onProgress?: (bytesUploaded: number) => void;
  onCaughtError?: (error: Error) => void;
  maxRetries?: number;
  signal?: AbortSignal;
  fetchFn?: FetchFunctionType;
}): Promise<void> {
  const backoff = new BackOff(FIBONACCI_TIMEOUTS, {
    jitter: BACKOFF_JITTER_MS,
  });

  let retryAttempts = 0;
  while (retryAttempts < maxRetries) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(backoff.getAndIncrement());
    retryAttempts += 1;

    // eslint-disable-next-line no-await-in-loop
    const uploadOffset = await _tusGetCurrentOffsetRequest({
      endpoint,
      headers,
      fileName,
      signal,
      fetchFn,
    });

    if (uploadOffset === fileSize) {
      break;
    }

    const readable = reader(filePath, uploadOffset);

    // eslint-disable-next-line no-await-in-loop
    const done = await _tusResumeUploadRequest({
      endpoint,
      headers,
      fileName,
      uploadOffset,
      readable,
      onProgress,
      onCaughtError,
      signal,
      fetchFn,
    });

    if (done) {
      break;
    }
  }
}
