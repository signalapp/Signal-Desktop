// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FileHandle } from 'fs/promises';
import { readFile, open } from 'fs/promises';
import type { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { gunzip as nativeGunzip } from 'zlib';
import got from 'got';
import { chunk as lodashChunk, noop } from 'lodash';
import pMap from 'p-map';
import Dicer from '@indutny/dicer';

import { strictAssert } from '../util/assert';
import { wrapEventEmitterOnce } from '../util/wrapEventEmitterOnce';
import type { LoggerType } from '../types/Logging';
import { getGotOptions } from './got';
import type { GotOptions } from './got';
import { checkIntegrity } from './util';

const gunzip = promisify(nativeGunzip);

const SUPPORTED_VERSION = '2';
const MAX_SINGLE_REQ_RANGES = 50; // 20 bytes per range, ~1kb total per request
const MAX_CONCURRENCY = 5;

type BlockMapFileJSONType = Readonly<{
  version: string;
  files: ReadonlyArray<
    Readonly<{
      name: string;
      offset: number;
      checksums: ReadonlyArray<string>;
      sizes: ReadonlyArray<number>;
    }>
  >;
}>;

export type BlockMapBlockType = Readonly<{
  offset: number;
  size: number;
  checksum: string;
}>;

export type BlockMapType = ReadonlyArray<BlockMapBlockType>;

export type DiffType = {
  action: 'download' | 'copy';
  size: number;
  readOffset: number;
  writeOffset: number;
};

export type ComputeDiffResultType = ReadonlyArray<Readonly<DiffType>>;

export type PrepareDownloadResultType = Readonly<{
  downloadSize: number;
  oldFile: string;
  newUrl: string;
  sha512: string;
  diff: ComputeDiffResultType;

  // This could be used by caller to avoid extra download of the blockmap
  newBlockMap: Buffer;
}>;

export type PrepareDownloadOptionsType = Readonly<{
  oldFile: string;
  newUrl: string;
  sha512: string;
}>;

export type DownloadOptionsType = Readonly<{
  statusCallback?: (downloadedSize: number, downloadSize: number) => void;
  logger?: LoggerType;

  // Testing
  gotOptions?: GotOptions;
}>;

export type DownloadRangesOptionsType = Readonly<{
  url: string;
  output: FileHandle;
  ranges: ReadonlyArray<DiffType>;
  logger?: LoggerType;
  abortSignal?: AbortSignal;
  chunkStatusCallback: (chunkSize: number) => void;

  // Testing
  gotOptions?: GotOptions;
}>;

export function getBlockMapFileName(fileName: string): string {
  return `${fileName}.blockmap`;
}

export async function parseBlockMap(data: Buffer): Promise<BlockMapType> {
  const unpacked = await gunzip(data);
  const json: BlockMapFileJSONType = JSON.parse(unpacked.toString());

  strictAssert(
    json.version === SUPPORTED_VERSION,
    `Unsupported blockmap version: ${json.version}`
  );
  strictAssert(
    json.files.length === 1,
    `Unsupported blockmap file count: ${json.files.length}`
  );

  const [file] = json.files;
  let { offset } = file;

  const blocks = new Array<BlockMapBlockType>();
  for (const [i, checksum] of file.checksums.entries()) {
    const size = file.sizes[i];
    strictAssert(size !== undefined, `missing block size: ${i}`);

    blocks.push({
      offset,
      size,
      checksum,
    });

    offset += size;
  }

  return blocks;
}

export function computeDiff(
  oldMap: BlockMapType,
  newMap: BlockMapType
): ComputeDiffResultType {
  const oldChecksums = new Map<string, Array<BlockMapBlockType>>();
  for (const oldBlock of oldMap) {
    let list = oldChecksums.get(oldBlock.checksum);
    if (!list) {
      list = [];
      oldChecksums.set(oldBlock.checksum, list);
    }

    list.push(oldBlock);
  }

  const diff = new Array<DiffType>();

  let writeOffset = 0;
  for (const newBlock of newMap) {
    const oldBlocks = oldChecksums.get(newBlock.checksum);
    if (oldBlocks) {
      const oldBlock = oldBlocks.shift();
      strictAssert(oldBlock, 'Missing expected old block');
      if (oldBlocks.length === 0) {
        oldChecksums.delete(newBlock.checksum);
      }

      strictAssert(
        oldBlock.size === newBlock.size,
        `Block size mismatch: ${newBlock.checksum}, ` +
          `${oldBlock.size} != ${newBlock.size}`
      );

      diff.push({
        action: 'copy',
        size: oldBlock.size,
        readOffset: oldBlock.offset,
        writeOffset,
      });
      writeOffset += oldBlock.size;
      continue;
    }

    diff.push({
      action: 'download',
      size: newBlock.size,
      readOffset: newBlock.offset,
      writeOffset,
    });
    writeOffset += newBlock.size;
  }

  const optimizedDiff = new Array<DiffType>();
  for (const entry of diff) {
    const last =
      optimizedDiff.length !== 0
        ? optimizedDiff[optimizedDiff.length - 1]
        : undefined;

    const { action, readOffset, size } = entry;
    if (
      !last ||
      last.action !== action ||
      last.readOffset + last.size !== readOffset
    ) {
      optimizedDiff.push(entry);
      continue;
    }

    last.size += size;
  }

  return optimizedDiff.filter(({ size }) => size !== 0);
}

export async function prepareDownload({
  oldFile,
  newUrl,
  sha512,
}: PrepareDownloadOptionsType): Promise<PrepareDownloadResultType> {
  const oldBlockMap = await parseBlockMap(
    await readFile(getBlockMapFileName(oldFile))
  );

  const newBlockMapData = await got(
    getBlockMapFileName(newUrl),
    await getGotOptions()
  ).buffer();

  const newBlockMap = await parseBlockMap(newBlockMapData);

  const diff = computeDiff(oldBlockMap, newBlockMap);

  let downloadSize = 0;
  for (const { action, size } of diff) {
    if (action === 'download') {
      downloadSize += size;
    }
  }

  return {
    downloadSize,
    diff,
    oldFile,
    newUrl,
    newBlockMap: newBlockMapData,
    sha512,
  };
}

export function isValidPreparedData(
  { oldFile, newUrl, sha512 }: PrepareDownloadResultType,
  options: PrepareDownloadOptionsType
): boolean {
  return (
    oldFile === options.oldFile &&
    newUrl === options.newUrl &&
    sha512 === options.sha512
  );
}

export async function download(
  newFile: string,
  { diff, oldFile, newUrl, sha512 }: PrepareDownloadResultType,
  { statusCallback, logger, gotOptions }: DownloadOptionsType = {}
): Promise<void> {
  const input = await open(oldFile, 'r');
  const output = await open(newFile, 'w');

  const abortController = new AbortController();
  const { signal: abortSignal } = abortController;

  const copyActions = diff.filter(({ action }) => action === 'copy');

  const copyPromise: Promise<unknown> = Promise.all(
    copyActions.map(async ({ readOffset, size, writeOffset }) => {
      const chunk = Buffer.alloc(size);
      const { bytesRead } = await input.read(
        chunk,
        0,
        chunk.length,
        readOffset
      );

      strictAssert(
        bytesRead === size,
        `Not enough data to read from offset=${readOffset} size=${size}`
      );

      if (abortSignal?.aborted) {
        return;
      }

      await output.write(chunk, 0, chunk.length, writeOffset);
    })
  );

  const downloadActions = diff.filter(({ action }) => action === 'download');
  let downloadSize = 0;
  for (const { size } of downloadActions) {
    downloadSize += size;
  }

  try {
    let downloadedSize = 0;

    await Promise.all([
      copyPromise,
      downloadRanges({
        url: newUrl,
        output,
        ranges: downloadActions,
        logger,
        abortSignal,
        gotOptions,
        chunkStatusCallback(chunkSize) {
          downloadedSize += chunkSize;
          if (!abortSignal.aborted) {
            statusCallback?.(downloadedSize, downloadSize);
          }
        },
      }),
    ]);
  } catch (error) {
    abortController.abort();
    throw error;
  } finally {
    await Promise.all([input.close(), output.close()]);
  }

  const checkResult = await checkIntegrity(newFile, sha512);
  strictAssert(checkResult.ok, checkResult.error ?? '');
}

export async function downloadRanges(
  options: DownloadRangesOptionsType
): Promise<void> {
  const { ranges } = options;

  // If we have way too many ranges - split them up into multiple requests
  if (ranges.length > MAX_SINGLE_REQ_RANGES) {
    await pMap(
      lodashChunk(ranges, MAX_SINGLE_REQ_RANGES),
      subRanges =>
        downloadRanges({
          ...options,
          ranges: subRanges,
        }),
      { concurrency: MAX_CONCURRENCY }
    );

    return;
  }

  // Request multiple ranges in a single request
  const {
    url,
    output,
    logger,
    abortSignal,
    chunkStatusCallback,
    gotOptions = await getGotOptions(),
  } = options;

  logger?.info('updater/downloadRanges: downloading ranges', ranges.length);

  // Map from `Content-Range` header value to respective DiffType object.
  const diffByRange = new Map<string, DiffType>();
  for (const diff of ranges) {
    const { action, readOffset, size } = diff;
    strictAssert(action === 'download', 'Incorrect action type');

    // NOTE: the range is inclusive, hence `size - 1`
    diffByRange.set(`${readOffset}-${readOffset + size - 1}`, diff);
  }

  const stream = got.stream(url, {
    ...gotOptions,
    headers: {
      ...gotOptions.headers,
      range: `bytes=${Array.from(diffByRange.keys()).join(',')}`,
    },
  });

  // Each `part` is a separate readable stream for one of the ranges
  const onPart = async (part: Dicer.PartStream): Promise<void> => {
    try {
      const diff = await takeDiffFromPart(part, diffByRange);

      await saveDiffStream({
        diff,
        stream: part,
        abortSignal,
        output,
        chunkStatusCallback,
      });
    } catch (error) {
      dicer.destroy(error);
    }
  };

  let boundary: string;
  try {
    const [{ statusCode, headers }] = await wrapEventEmitterOnce(
      stream,
      'response'
    );

    strictAssert(statusCode === 206, `Invalid status code: ${statusCode}`);

    const match = headers['content-type']?.match(
      /^multipart\/byteranges;\s*boundary=([^\s;]+)/
    );

    // When the result is single range we might non-multipart response
    if (ranges.length === 1 && !match) {
      await saveDiffStream({
        diff: ranges[0],
        stream,
        abortSignal,
        output,
        chunkStatusCallback,
      });
      return;
    }

    // eslint-disable-next-line prefer-destructuring
    boundary = match[1];
  } catch (error) {
    // Ignore further errors and destroy stream early
    stream.on('error', noop);
    stream.destroy();

    throw error;
  }

  const dicer = new Dicer({ boundary });

  const partPromises = new Array<Promise<void>>();
  dicer.on('part', part => partPromises.push(onPart(part)));

  // Pipe the response stream fully into dicer
  await pipeline(stream, dicer);

  // Wait for individual parts to be fully written to FS
  await Promise.all(partPromises);

  if (abortSignal?.aborted) {
    return;
  }

  const missingRanges = Array.from(diffByRange.values());
  if (missingRanges.length === 0) {
    return;
  }

  logger?.info(
    'updater/downloadRanges: downloading missing ranges',
    diffByRange.size
  );
  return downloadRanges({
    ...options,
    ranges: missingRanges,
  });
}

async function takeDiffFromPart(
  part: Dicer.PartStream,
  diffByRange: Map<string, DiffType>
): Promise<DiffType> {
  const [untypedHeaders] = await wrapEventEmitterOnce(part, 'header');
  const headers = untypedHeaders as Record<string, Array<string>>;

  const contentRange = headers['content-range'];
  strictAssert(contentRange, 'Missing Content-Range header for the part');

  const match = contentRange.join(', ').match(/^bytes\s+(\d+-\d+)/);
  strictAssert(
    match,
    `Invalid Content-Range header for the part: "${contentRange}"`
  );

  const range = match[1];

  const diff = diffByRange.get(range);
  strictAssert(diff, `Diff not found for range="${range}"`);

  diffByRange.delete(range);

  return diff;
}

async function saveDiffStream({
  diff,
  stream,
  output,
  abortSignal,
  chunkStatusCallback,
}: {
  diff: DiffType;
  stream: Readable;
  output: FileHandle;
  abortSignal?: AbortSignal;
  chunkStatusCallback: (chunkSize: number) => void;
}): Promise<void> {
  let offset = 0;
  for await (const chunk of stream) {
    strictAssert(
      offset + chunk.length <= diff.size,
      'Server returned more data than expected, ' +
        `written=${offset} ` +
        `newChunk=${chunk.length} ` +
        `maxSize=${diff.size}`
    );

    if (abortSignal?.aborted) {
      return;
    }

    await output.write(chunk, 0, chunk.length, offset + diff.writeOffset);
    offset += chunk.length;

    // Check for signal again so that we don't invoke status callback when
    // aborted.
    if (abortSignal?.aborted) {
      return;
    }

    chunkStatusCallback(chunk.length);
  }

  strictAssert(
    offset === diff.size,
    `Not enough data to download from offset=${diff.readOffset} ` +
      `size=${diff.size}`
  );
}
