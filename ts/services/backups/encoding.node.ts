// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';
import {
  BackupJsonExporter,
  flushInterval,
  paddingSize,
} from '@signalapp/libsignal-client/dist/MessageBackup.js';

import { Backups } from '../../protobuf/index.std.ts';
import { encodeDelimited } from '../../util/encodeDelimited.std.ts';
import { drop } from '../../util/drop.std.ts';
import { wrapEventEmitterOnce } from '../../util/wrapEventEmitterOnce.node.ts';
import type { LoggerType } from '../../types/Logging.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';

type RunResultType = Readonly<{
  info: Backups.BackupInfo.Params;
  iterable: AsyncIterable<NonNullable<Backups.Frame.Params['item']>>;
}>;

// Number of frames to keep buffered
const BUFFER_SIZE = 10000;

function buffered(
  iterable: RunResultType['iterable']
): RunResultType['iterable'] {
  return Readable.from(iterable, {
    objectMode: true,
    highWaterMark: BUFFER_SIZE,
  })[Symbol.asyncIterator]();
}

export async function* toDelimitedIterable({
  info,
  iterable,
}: RunResultType): AsyncIterable<Uint8Array<ArrayBuffer>> {
  yield* encodeDelimited(Backups.BackupInfo.encode(info));

  for await (const item of buffered(iterable)) {
    yield* encodeDelimited(Backups.Frame.encode({ item }));
  }
}

function* generateFlushOffsets(): Iterator<bigint> {
  let offset = 0n;

  // oxlint-disable-next-line no-constant-condition
  while (true) {
    const interval = flushInterval(offset);
    offset += interval;
    yield offset;
  }
}

export async function* toPaddedGzipIterable({
  info,
  iterable,
}: RunResultType): AsyncIterable<Uint8Array<ArrayBuffer>> {
  // Track chat item blocks
  let largestBlock = 0n;
  let currentBlock = 0n;
  function onNewBlock() {
    if (currentBlock > largestBlock) {
      largestBlock = currentBlock;
    }
    currentBlock = 0n;
  }

  async function* delimited(): AsyncIterable<Uint8Array<ArrayBuffer> | null> {
    yield* encodeDelimited(Backups.BackupInfo.encode(info));

    // Flush after info frame
    yield null;

    // ChatItem bytes to flush at
    const flushOffsets = generateFlushOffsets();
    let flushOffset: bigint = flushOffsets.next().value;

    let chatItemsBytes = 0n;

    for await (const item of buffered(iterable)) {
      let flushBeforeAfter = false;

      // Flush before/after "account info"/recipients
      if (item.account != null || item.recipient != null) {
        flushBeforeAfter = true;
      }

      if (chatItemsBytes === 0n && item.chatItem != null) {
        // Flush *before* starting export of chat items
        yield null;
      } else if (chatItemsBytes !== 0n && item.chatItem == null) {
        // We got a non-chat item frame in between chat item frames,
        // flush before/after it and reset the block size.
        flushBeforeAfter = true;
        onNewBlock();
      }

      if (flushBeforeAfter) {
        yield null;
      }

      if (item.chatItem == null) {
        yield* encodeDelimited(Backups.Frame.encode({ item }));
      } else {
        let frame = Buffer.concat(
          encodeDelimited(Backups.Frame.encode({ item }))
        );

        // Split chat item frame into as many parts as need to cut at right
        // flush intervals
        while (frame.byteLength !== 0) {
          const cutOffset = flushOffset - chatItemsBytes;

          const slice = frame.subarray(0, Number(cutOffset));
          yield slice;
          chatItemsBytes += BigInt(slice.byteLength);
          currentBlock += BigInt(slice.byteLength);

          // We are finished
          if (frame.byteLength === slice.byteLength) {
            break;
          }

          // The frame was cut - flush, get the next offset, reset block size
          frame = frame.subarray(slice.byteLength);
          flushOffset = flushOffsets.next().value;
          onNewBlock();
          yield null;
        }
      }

      if (flushBeforeAfter) {
        yield null;
      }
    }
  }

  const gzip = createGzip();

  async function feedGzip() {
    try {
      // flushInterval() is capped at 512KiB so we can write all buffers at once
      // to save time on calling into C++
      let buffer = new Array<Uint8Array<ArrayBuffer>>();
      for await (const chunk of delimited()) {
        if (chunk != null) {
          buffer.push(chunk);
          continue;
        }

        const written = gzip.write(Buffer.concat(buffer));
        buffer = [];
        gzip.flush();
        if (!written) {
          await wrapEventEmitterOnce(gzip, 'drain');
        }
      }
      gzip.end(Buffer.concat(buffer));
    } catch (error) {
      gzip.destroy(error);
    }
  }

  drop(feedGzip());

  let compressedLength = 0n;
  for await (const chunk of gzip) {
    compressedLength += BigInt(chunk.byteLength);
    yield chunk;
  }

  const padding = paddingSize(largestBlock, compressedLength);
  const PADDING_CHUNK_SIZE = 64 * 1024;
  const empty = Buffer.alloc(PADDING_CHUNK_SIZE);
  for (let i = 0n; i < padding; i += BigInt(empty.byteLength)) {
    const remaining = padding - i;
    if (remaining >= BigInt(empty.byteLength)) {
      yield empty;
    } else {
      yield empty.subarray(0, Number(remaining));
    }
  }
}

export async function* toJSONIterable(
  { info, iterable }: RunResultType,
  log?: LoggerType
): AsyncIterable<string> {
  const { exporter, chunk: initialChunk } = BackupJsonExporter.start(
    Backups.BackupInfo.encode(info),
    { validate: false }
  );

  yield `${initialChunk}\n`;

  for await (const item of buffered(iterable)) {
    const results = exporter.exportFrames(
      Buffer.concat(encodeDelimited(Backups.Frame.encode({ item })))
    );

    for (const result of results) {
      if (result.errorMessage) {
        log?.warn(
          'frameToJson: frame had a validation error:',
          result.errorMessage
        );
      }
      if (!result.line) {
        log?.error('frameToJson: frame was filtered out by libsignal');
      } else {
        yield `${result.line}\n`;
      }
    }
  }

  try {
    const result = exporter.finish();
    if (result?.errorMessage) {
      log?.warn(
        'jsonExporter.finish() returned validation error:',
        result.errorMessage
      );
    }
  } catch (error) {
    // We only warn because this isn't that big of a deal - the export is complete.
    // All we need from the exporter at the end is any validation errors it found.
    log?.warn('jsonExporter returned error', toLogFormat(error));
  }
}
