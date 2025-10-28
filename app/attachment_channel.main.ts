// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DefaultStorage, RangeFinder } from '@indutny/range-finder';
import {
  DigestingPassThrough,
  ValidatingPassThrough,
  inferChunkSize,
} from '@signalapp/libsignal-client/dist/incremental_mac.js';
import { ipcMain, protocol } from 'electron';
import { LRUCache } from 'lru-cache';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, rmSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { PassThrough, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import z from 'zod';
import GrowingFile from 'growing-file';
import lodash from 'lodash';
import { pathExists } from 'fs-extra';

import {
  type DecryptAttachmentToSinkOptionsType,
  decryptAttachmentV2ToSink,
} from '../ts/AttachmentCrypto.node.js';
import * as Bytes from '../ts/Bytes.std.js';
import type { MessageAttachmentsCursorType } from '../ts/sql/Interface.std.js';
import type { MainSQL } from '../ts/sql/main.main.js';
import {
  APPLICATION_OCTET_STREAM,
  MIMETypeToString,
  stringToMIMEType,
} from '../ts/types/MIME.std.js';
import * as Errors from '../ts/types/errors.std.js';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../ts/util/GoogleChrome.std.js';
import { strictAssert } from '../ts/util/assert.std.js';
import { drop } from '../ts/util/drop.std.js';
import { SECOND } from '../ts/util/durations/index.std.js';
import { isPathInside } from '../ts/util/isPathInside.node.js';
import { missingCaseError } from '../ts/util/missingCaseError.std.js';
import { safeParseInteger } from '../ts/util/numbers.std.js';
import { parseLoose } from '../ts/util/schemas.std.js';
import { sleep } from '../ts/util/sleep.std.js';
import { toWebStream } from '../ts/util/toWebStream.node.js';
import { createLogger } from '../ts/logging/log.std.js';
import {
  deleteAll as deleteAllAttachments,
  deleteAllBadges,
  deleteAllDownloads,
  deleteAllDraftAttachments,
  deleteAllStickers,
  deleteStaleDownloads,
  getAllAttachments,
  getAllDownloads,
  getAllDraftAttachments,
  getAllStickers,
  getAvatarsPath,
  getDownloadsPath,
  getDraftPath,
  getPath,
  getStickersPath,
  getTempPath,
} from './attachments.node.js';

const { isNumber } = lodash;

const log = createLogger('attachment_channel');

let initialized = false;

const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const ERASE_DRAFTS_KEY = 'erase-drafts';
const ERASE_DOWNLOADS_KEY = 'erase-downloads';
const CLEANUP_DOWNLOADS_KEY = 'cleanup-downloads';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

const INTERACTIVITY_DELAY = 50;

// Matches the value in WebAPI.ts
const GET_ATTACHMENT_CHUNK_TIMEOUT = 10 * SECOND;
const GROWING_FILE_TIMEOUT = GET_ATTACHMENT_CHUNK_TIMEOUT * 1.5;

type RangeFinderContextType = Readonly<
  (
    | {
        type: 'ciphertext';
        keysBase64: string;
        size: number;
      }
    | {
        type: 'incremental';
        digest: Uint8Array;
        incrementalMac: Uint8Array;
        chunkSize: number;
        keysBase64: string;
        size: number;
      }
    | {
        type: 'plaintext';
      }
  ) & {
    path: string;
  }
>;

type DigestLRUEntryType = Readonly<{
  key: Buffer;
  digest: Uint8Array;
}>;

const digestLRU = new LRUCache<string, DigestLRUEntryType>({
  // The size of each entry is roughly 8kb per digest + 32 bytes per key. We
  // mostly need this cache for range requests, so keep it low.
  max: 100,
});

async function safeDecryptToSink(
  ctx: RangeFinderContextType,
  sink: Writable
): Promise<void> {
  strictAssert(
    ctx.type === 'ciphertext' || ctx.type === 'incremental',
    'Cannot decrypt plaintext'
  );

  try {
    if (ctx.type === 'incremental') {
      const ciphertextStream = new PassThrough();
      const file = GrowingFile.open(ctx.path, {
        timeout: GROWING_FILE_TIMEOUT,
      });
      file.on('error', (error: Error) => {
        log.warn(
          'safeDecryptToSink/incremental: growing-file emitted an error:',
          Errors.toLogFormat(error)
        );
      });
      file.pipe(ciphertextStream);

      const options: DecryptAttachmentToSinkOptionsType = {
        ciphertextStream,
        idForLogging: 'attachment_channel/incremental',
        keysBase64: ctx.keysBase64,
        size: ctx.size,
        theirChunkSize: ctx.chunkSize,
        theirIncrementalMac: ctx.incrementalMac,
        type: 'standard',
        integrityCheck: {
          type: 'encrypted',
          digest: ctx.digest,
        },
      };

      const controller = new AbortController();

      await Promise.race([
        // Just use a non-existing event name to wait for an 'error'. We want
        // to handle errors on `sink` while generating digest in case the whole
        // request gets canceled early.
        once(sink, 'non-error-event', { signal: controller.signal }),
        decryptAttachmentV2ToSink(options, sink),
      ]);

      // Stop handling errors on sink
      controller.abort();

      return;
    }

    const options = {
      ciphertextPath: ctx.path,
      idForLogging: 'attachment_channel/ciphertext',
      keysBase64: ctx.keysBase64,
      size: ctx.size,
      type: 'local' as const,
    };

    const chunkSize = inferChunkSize(ctx.size);
    let entry = digestLRU.get(ctx.path);
    if (!entry) {
      const key = randomBytes(32);
      const digester = new DigestingPassThrough(key, chunkSize);

      // Important to do this so the pipeline() returns in the decrypt call below
      digester.resume();

      const controller = new AbortController();

      await Promise.race([
        // Same as above usage of the once() pattern
        once(sink, 'non-error-event', { signal: controller.signal }),
        decryptAttachmentV2ToSink(options, digester),
      ]);

      // Stop handling errors on sink
      controller.abort();

      entry = {
        key,
        digest: digester.getFinalDigest(),
      };
      digestLRU.set(ctx.path, entry);
    }

    const validator = new ValidatingPassThrough(
      entry.key,
      chunkSize,
      entry.digest
    );
    await Promise.all([
      decryptAttachmentV2ToSink(options, validator),
      pipeline(validator, sink),
    ]);
  } catch (error) {
    // These errors happen when canceling fetch from `attachment://` urls,
    // ignore them to avoid noise in the logs.
    if (
      error.name === 'AbortError' ||
      error.code === 'ERR_STREAM_PREMATURE_CLOSE'
    ) {
      return;
    }

    log.error(
      'handleAttachmentRequest: decryption error',
      Errors.toLogFormat(error)
    );
  }
}

const storage = new DefaultStorage<RangeFinderContextType>(
  ctx => {
    if (ctx.type === 'plaintext') {
      return createReadStream(ctx.path);
    }

    if (ctx.type === 'ciphertext' || ctx.type === 'incremental') {
      const plaintext = new PassThrough();
      drop(safeDecryptToSink(ctx, plaintext));
      return plaintext;
    }

    throw missingCaseError(ctx);
  },
  {
    maxSize: 10,
    ttl: SECOND,
    cacheKey: ctx => {
      if (ctx.type === 'ciphertext' || ctx.type === 'incremental') {
        return `${ctx.type}:${ctx.path}:${ctx.size}:${ctx.keysBase64}`;
      }
      if (ctx.type === 'plaintext') {
        return `${ctx.type}:${ctx.path}`;
      }
      throw missingCaseError(ctx);
    },
  }
);
const rangeFinder = new RangeFinder<RangeFinderContextType>(storage, {
  noActiveReuse: true,
});

const dispositionSchema = z.enum([
  'attachment',
  'avatarData',
  'download',
  'draft',
  'temporary',
  'sticker',
]);

type DeleteOrphanedAttachmentsOptionsType = Readonly<{
  orphanedAttachments: Set<string>;
  orphanedDownloads: Set<string>;
  sql: MainSQL;
  userDataPath: string;
}>;

type CleanupOrphanedAttachmentsOptionsType = Readonly<{
  sql: MainSQL;
  userDataPath: string;
  _block?: boolean;
}>;

async function cleanupOrphanedAttachments({
  sql,
  userDataPath,
  _block = false,
}: CleanupOrphanedAttachmentsOptionsType): Promise<void> {
  await deleteAllBadges({
    userDataPath,
    pathsToKeep: await sql.sqlRead('getAllBadgeImageFileLocalPaths'),
  });

  const allStickers = await getAllStickers(userDataPath);
  const orphanedStickers = await sql.sqlWrite(
    'removeKnownStickers',
    allStickers
  );
  await deleteAllStickers({
    userDataPath,
    stickers: orphanedStickers,
  });

  const allDraftAttachments = await getAllDraftAttachments(userDataPath);
  const orphanedDraftAttachments = await sql.sqlWrite(
    'removeKnownDraftAttachments',
    allDraftAttachments
  );
  await deleteAllDraftAttachments({
    userDataPath,
    attachments: orphanedDraftAttachments,
  });

  const orphanedAttachments = new Set(await getAllAttachments(userDataPath));
  log.info(
    'cleanupOrphanedAttachments: found ' +
      `${orphanedAttachments.size} attachments on disk`
  );

  const orphanedDownloads = new Set(await getAllDownloads(userDataPath));
  log.info(
    'cleanupOrphanedAttachments: found ' +
      `${orphanedDownloads.size} downloads on disk`
  );

  {
    const conversationAttachments: Array<string> = await sql.sqlRead(
      'getKnownConversationAttachments'
    );

    let missingConversationAttachments = 0;
    for (const known of conversationAttachments) {
      if (!orphanedAttachments.delete(known)) {
        missingConversationAttachments += 1;
      }
    }

    log.info(
      `cleanupOrphanedAttachments: Got ${conversationAttachments.length} conversation attachments,` +
        ` ${orphanedAttachments.size} remain`
    );

    if (missingConversationAttachments > 0) {
      log.warn(
        `cleanupOrphanedAttachments: ${missingConversationAttachments} conversation attachments were not found on disk`
      );
    }
  }

  {
    const downloads: Array<string> = await sql.sqlRead('getKnownDownloads');

    let missing = 0;
    for (const known of downloads) {
      if (!orphanedDownloads.delete(known)) {
        missing += 1;
      }
    }

    log.info(
      `cleanupOrphanedAttachments: found ${downloads.length} known downloads, ` +
        `${orphanedDownloads.size} remain`
    );

    if (missing > 0) {
      log.warn(
        `cleanupOrphanedAttachments: ${missing} downloads were not found on disk`
      );
    }
  }

  // This call is intentionally not awaited. We block the app while running
  // all fetches above to ensure that there are no in-flight attachments that
  // are saved to disk, but not put into any message or conversation model yet.
  const deletePromise = deleteOrphanedAttachments({
    orphanedAttachments,
    orphanedDownloads,
    sql,
    userDataPath,
  });

  if (_block) {
    await deletePromise;
  } else {
    drop(deletePromise);
  }
}

function deleteOrphanedAttachments({
  orphanedAttachments,
  orphanedDownloads,
  sql,
  userDataPath,
}: DeleteOrphanedAttachmentsOptionsType): Promise<void> {
  // This function *can* throw.
  async function runWithPossibleException(): Promise<void> {
    let cursor: MessageAttachmentsCursorType | undefined;
    let totalAttachmentsFound = 0;
    let totalMissing = 0;
    let totalDownloadsFound = 0;

    try {
      do {
        let attachments: ReadonlyArray<string>;
        let downloads: ReadonlyArray<string>;

        // eslint-disable-next-line no-await-in-loop
        ({ attachments, downloads, cursor } = await sql.sqlRead(
          'getKnownMessageAttachments',
          cursor
        ));

        totalAttachmentsFound += attachments.length;
        totalDownloadsFound += downloads.length;

        for (const known of attachments) {
          if (!orphanedAttachments.delete(known)) {
            totalMissing += 1;
          }
        }

        for (const known of downloads) {
          orphanedDownloads.delete(known);
        }

        if (cursor === undefined) {
          break;
        }

        // Let other SQL calls come through. There are hundreds of thousands of
        // messages in the database and it might take time to go through them all.
        // eslint-disable-next-line no-await-in-loop
        await sleep(INTERACTIVITY_DELAY);
      } while (cursor !== undefined && !cursor.done);
    } finally {
      if (cursor !== undefined) {
        await sql.sqlRead('finishGetKnownMessageAttachments', cursor);
      }
    }
    log.info(
      `cleanupOrphanedAttachments: ${totalAttachmentsFound} attachments and \
      ${totalDownloadsFound} downloads found on disk`
    );

    if (orphanedAttachments.size > 0) {
      log.error(`${orphanedAttachments.size} orphaned attachment(s) found`);
    }

    if (totalMissing > 0) {
      log.warn(
        `cleanupOrphanedAttachments: ${totalMissing} message attachments were not found on disk`
      );
    }

    await deleteAllAttachments({
      userDataPath,
      attachments: Array.from(orphanedAttachments),
    });

    if (orphanedDownloads.size > 0) {
      log.error(`${orphanedDownloads.size} orphaned download(s) found`);
    }

    await deleteAllDownloads({
      userDataPath,
      downloads: Array.from(orphanedDownloads),
    });
  }

  async function runSafe() {
    const start = Date.now();
    try {
      await runWithPossibleException();
    } catch (error) {
      log.error('deleteOrphanedAttachments: error', Errors.toLogFormat(error));
    } finally {
      const duration = Date.now() - start;
      log.info(`deleteOrphanedAttachments: took ${duration}ms`);
    }
  }

  return runSafe();
}

let attachmentsDir: string | undefined;
let stickersDir: string | undefined;
let tempDir: string | undefined;
let draftDir: string | undefined;
let downloadsDir: string | undefined;
let avatarDataDir: string | undefined;

export function initialize({
  configDir,
  sql,
}: {
  configDir: string;
  sql: MainSQL;
}): void {
  if (initialized) {
    throw new Error('initialize: Already initialized!');
  }
  initialized = true;

  attachmentsDir = getPath(configDir);
  stickersDir = getStickersPath(configDir);
  tempDir = getTempPath(configDir);
  draftDir = getDraftPath(configDir);
  downloadsDir = getDownloadsPath(configDir);
  avatarDataDir = getAvatarsPath(configDir);

  ipcMain.handle(ERASE_TEMP_KEY, () => {
    strictAssert(tempDir != null, 'not initialized');
    rmSync(tempDir);
  });
  ipcMain.handle(ERASE_ATTACHMENTS_KEY, () => {
    strictAssert(attachmentsDir != null, 'not initialized');
    rmSync(attachmentsDir, { recursive: true, force: true });
  });
  ipcMain.handle(ERASE_STICKERS_KEY, () => {
    strictAssert(stickersDir != null, 'not initialized');
    rmSync(stickersDir, { recursive: true, force: true });
  });
  ipcMain.handle(ERASE_DRAFTS_KEY, () => {
    strictAssert(draftDir != null, 'not initialized');
    rmSync(draftDir, { recursive: true, force: true });
  });
  ipcMain.handle(ERASE_DOWNLOADS_KEY, () => {
    strictAssert(downloadsDir != null, 'not initialized');
    rmSync(downloadsDir, { recursive: true, force: true });
  });

  ipcMain.handle(
    CLEANUP_ORPHANED_ATTACHMENTS_KEY,
    async (_event, { _block }) => {
      const start = Date.now();
      await cleanupOrphanedAttachments({
        sql,
        userDataPath: configDir,
        _block,
      });
      const duration = Date.now() - start;
      log.info(`cleanupOrphanedAttachments: took ${duration}ms`);
    }
  );

  ipcMain.handle(CLEANUP_DOWNLOADS_KEY, async () => {
    const start = Date.now();
    await deleteStaleDownloads(configDir);
    const duration = Date.now() - start;
    log.info(`cleanupDownloads: took ${duration}ms`);
  });

  protocol.handle('attachment', handleAttachmentRequest);
}

export async function handleAttachmentRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.host !== 'v1' && url.host !== 'v2') {
    return new Response('Unknown host', { status: 404 });
  }

  // Disposition
  let disposition: z.infer<typeof dispositionSchema> = 'attachment';
  const dispositionParam = url.searchParams.get('disposition');
  if (dispositionParam != null) {
    disposition = parseLoose(dispositionSchema, dispositionParam);
  }

  strictAssert(attachmentsDir != null, 'not initialized');
  strictAssert(tempDir != null, 'not initialized');
  strictAssert(downloadsDir != null, 'not initialized');
  strictAssert(draftDir != null, 'not initialized');
  strictAssert(stickersDir != null, 'not initialized');
  strictAssert(avatarDataDir != null, 'not initialized');

  let parentDir: string;
  switch (disposition) {
    case 'attachment':
      parentDir = attachmentsDir;
      break;
    case 'download':
      parentDir = downloadsDir;
      break;
    case 'temporary':
      parentDir = tempDir;
      break;
    case 'draft':
      parentDir = draftDir;
      break;
    case 'sticker':
      parentDir = stickersDir;
      break;
    case 'avatarData':
      parentDir = avatarDataDir;
      break;
    default:
      throw missingCaseError(disposition);
  }

  // Remove first slash
  const path = normalize(
    join(parentDir, ...url.pathname.slice(1).split(/\//g))
  );
  if (!isPathInside(path, parentDir)) {
    return new Response('Access denied', { status: 401 });
  }

  // Some attachments have weak references (e.g. copied quotes) and we
  // don't want to treat those attachments missing as an error
  const weakReferenceParam = url.searchParams.get('weakReference');
  if (weakReferenceParam != null) {
    strictAssert(
      disposition === 'attachment',
      'Only attachments can have weak references'
    );
    const fileExists = await pathExists(path);
    if (!fileExists) {
      return new Response('Weakly referenced attachment does not exist', {
        status: 404,
      });
    }
  }

  // Get attachment size to trim the padding
  const sizeParam = url.searchParams.get('size');
  let maybeSize: number | undefined;
  if (sizeParam != null) {
    const intValue = safeParseInteger(sizeParam);
    if (intValue != null) {
      maybeSize = intValue;
    }
  }

  let context: RangeFinderContextType;

  // Legacy plaintext attachments
  if (url.host === 'v1') {
    context = {
      type: 'plaintext',
      path,
    };
  } else {
    // Encrypted attachments

    // Get AES+MAC key
    const keysBase64 = url.searchParams.get('key');
    if (keysBase64 == null) {
      return new Response('Missing key', { status: 400 });
    }

    // Size is required for trimming padding
    if (maybeSize == null) {
      return new Response('Missing size', { status: 400 });
    }

    if (disposition !== 'download') {
      context = {
        type: 'ciphertext',
        keysBase64,
        path,
        size: maybeSize,
      };
    } else {
      // When trying to view in-progress downloads, we need more information
      // to validate the file before returning data.

      const digestBase64 = url.searchParams.get('digest');
      if (digestBase64 == null) {
        return new Response('Missing digest', { status: 400 });
      }

      const incrementalMacBase64 = url.searchParams.get('incrementalMac');
      if (incrementalMacBase64 == null) {
        return new Response('Missing incrementalMac', { status: 400 });
      }

      const chunkSizeString = url.searchParams.get('chunkSize');
      const chunkSize = chunkSizeString
        ? parseInt(chunkSizeString, 10)
        : undefined;
      if (!isNumber(chunkSize)) {
        return new Response('Missing chunkSize', { status: 400 });
      }

      context = {
        type: 'incremental',
        chunkSize,
        digest: Bytes.fromBase64(digestBase64),
        incrementalMac: Bytes.fromBase64(incrementalMacBase64),
        keysBase64,
        path,
        size: maybeSize,
      };
    }
  }

  try {
    return handleRangeRequest({
      request: req,
      size: maybeSize,
      context,
    });
  } catch (error) {
    log.error('handleAttachmentRequest: error', Errors.toLogFormat(error));
    throw error;
  }
}

type HandleRangeRequestOptionsType = Readonly<{
  request: Request;
  size: number | undefined;
  context: RangeFinderContextType;
}>;

function handleRangeRequest({
  request,
  size,
  context,
}: HandleRangeRequestOptionsType): Response {
  const url = new URL(request.url);

  // Get content-type
  const contentTypeParam = url.searchParams.get('contentType');
  let contentType = MIMETypeToString(APPLICATION_OCTET_STREAM);
  if (contentTypeParam) {
    const mime = stringToMIMEType(contentTypeParam);
    if (isImageTypeSupported(mime) || isVideoTypeSupported(mime)) {
      contentType = MIMETypeToString(mime);
    }
  }

  const headers: HeadersInit = {
    'cache-control': 'no-cache, no-store',
    'content-type': contentType,
  };

  if (size != null) {
    headers['content-length'] = size.toString();
  }

  const create200Response = (): Response => {
    const plaintext = rangeFinder.get(0, context);
    return new Response(toWebStream(plaintext), {
      status: 200,
      headers,
    });
  };

  const range = request.headers.get('range');
  if (range == null) {
    return create200Response();
  }

  // Chromium only sends open-ended ranges: "start-"
  const match = range.match(/^bytes=(\d+)-$/);
  if (match == null) {
    log.error(`invalid range header: ${range}`);
    return create200Response();
  }

  const startParam = safeParseInteger(match[1]);
  if (startParam == null) {
    log.error(`invalid range header: ${range}`);
    return create200Response();
  }

  const start = Math.min(startParam, size || Infinity);

  headers['content-range'] = `bytes ${start}-/${size ?? '*'}`;

  if (size !== undefined) {
    headers['content-length'] = (size - start).toString();
  }

  const stream = rangeFinder.get(start, context);
  return new Response(toWebStream(stream), {
    status: 206,
    headers,
  });
}
