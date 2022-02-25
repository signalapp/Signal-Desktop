// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile, open, mkdtemp, mkdir, rename, unlink } from 'fs/promises';
import { promisify } from 'util';
import { gunzip as nativeGunzip } from 'zlib';
import { tmpdir } from 'os';
import path from 'path';
import got from 'got';
import pMap from 'p-map';

import { strictAssert } from '../util/assert';
import { getGotOptions } from './got';
import { checkIntegrity } from './util';

const gunzip = promisify(nativeGunzip);

const SUPPORTED_VERSION = '2';
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

  return optimizedDiff;
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
    getGotOptions()
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
  statusCallback?: (downloadedSize: number) => void
): Promise<void> {
  const input = await open(oldFile, 'r');

  const tempDir = await mkdtemp(path.join(tmpdir(), 'signal-temp-'));
  await mkdir(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, path.basename(newFile));

  const output = await open(tempFile, 'w');

  // Share agent
  const gotOptions = getGotOptions();

  let downloadedSize = 0;
  let isAborted = false;

  try {
    await pMap(
      diff,
      async ({ action, readOffset, size, writeOffset }) => {
        if (action === 'copy') {
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

          await output.write(chunk, 0, chunk.length, writeOffset);
          return;
        }

        strictAssert(action === 'download', 'invalid action type');
        const stream = got.stream(`${newUrl}`, {
          ...gotOptions,
          headers: {
            range: `bytes=${readOffset}-${readOffset + size - 1}`,
          },
        });

        stream.once('response', ({ statusCode }) => {
          if (statusCode !== 206) {
            stream.destroy(new Error(`Invalid status code: ${statusCode}`));
          }
        });

        let lastOffset = writeOffset;
        for await (const chunk of stream) {
          strictAssert(
            lastOffset - writeOffset + chunk.length <= size,
            'Server returned more data than expected'
          );
          await output.write(chunk, 0, chunk.length, lastOffset);
          lastOffset += chunk.length;

          downloadedSize += chunk.length;
          if (!isAborted) {
            statusCallback?.(downloadedSize);
          }
        }
        strictAssert(
          lastOffset - writeOffset === size,
          `Not enough data to download from offset=${readOffset} size=${size}`
        );
      },
      { concurrency: MAX_CONCURRENCY }
    );
  } catch (error) {
    isAborted = true;
    throw error;
  } finally {
    await Promise.all([input.close(), output.close()]);
  }

  const checkResult = await checkIntegrity(tempFile, sha512);
  strictAssert(checkResult.ok, checkResult.error ?? '');

  // Finally move the file into its final location
  try {
    await unlink(newFile);
  } catch (_) {
    // ignore errors
  }
  await rename(tempFile, newFile);
}
