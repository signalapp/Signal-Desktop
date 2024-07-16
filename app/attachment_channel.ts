// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain, protocol } from 'electron';
import { createReadStream } from 'node:fs';
import { join, normalize } from 'node:path';
import { Readable, Transform, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import z from 'zod';
import * as rimraf from 'rimraf';
import {
  getAllAttachments,
  getAvatarsPath,
  getPath,
  getStickersPath,
  getTempPath,
  getDraftPath,
  deleteAll as deleteAllAttachments,
  deleteAllBadges,
  getAllStickers,
  deleteAllStickers,
  getAllDraftAttachments,
  deleteAllDraftAttachments,
} from './attachments';
import type { MainSQL } from '../ts/sql/main';
import type { MessageAttachmentsCursorType } from '../ts/sql/Interface';
import * as Errors from '../ts/types/errors';
import { sleep } from '../ts/util/sleep';
import { isPathInside } from '../ts/util/isPathInside';
import { missingCaseError } from '../ts/util/missingCaseError';
import { safeParseInteger } from '../ts/util/numbers';
import { drop } from '../ts/util/drop';
import { strictAssert } from '../ts/util/assert';
import { decryptAttachmentV2ToSink } from '../ts/AttachmentCrypto';

let initialized = false;

const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const ERASE_DRAFTS_KEY = 'erase-drafts';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

const INTERACTIVITY_DELAY = 50;

const dispositionSchema = z.enum([
  'attachment',
  'temporary',
  'draft',
  'sticker',
  'avatarData',
]);

type DeleteOrphanedAttachmentsOptionsType = Readonly<{
  orphanedAttachments: Set<string>;
  sql: MainSQL;
  userDataPath: string;
}>;

type CleanupOrphanedAttachmentsOptionsType = Readonly<{
  sql: MainSQL;
  userDataPath: string;
}>;

async function cleanupOrphanedAttachments({
  sql,
  userDataPath,
}: CleanupOrphanedAttachmentsOptionsType): Promise<void> {
  await deleteAllBadges({
    userDataPath,
    pathsToKeep: await sql.sqlCall('getAllBadgeImageFileLocalPaths'),
  });

  const allStickers = await getAllStickers(userDataPath);
  const orphanedStickers = await sql.sqlCall(
    'removeKnownStickers',
    allStickers
  );
  await deleteAllStickers({
    userDataPath,
    stickers: orphanedStickers,
  });

  const allDraftAttachments = await getAllDraftAttachments(userDataPath);
  const orphanedDraftAttachments = await sql.sqlCall(
    'removeKnownDraftAttachments',
    allDraftAttachments
  );
  await deleteAllDraftAttachments({
    userDataPath,
    attachments: orphanedDraftAttachments,
  });

  // Delete orphaned attachments from conversations and messages.

  const orphanedAttachments = new Set(await getAllAttachments(userDataPath));
  console.log(
    'cleanupOrphanedAttachments: found ' +
      `${orphanedAttachments.size} attachments on disk`
  );

  {
    const attachments: ReadonlyArray<string> = await sql.sqlCall(
      'getKnownConversationAttachments'
    );

    let missing = 0;
    for (const known of attachments) {
      if (!orphanedAttachments.delete(known)) {
        missing += 1;
      }
    }

    console.log(
      `cleanupOrphanedAttachments: found ${attachments.length} conversation ` +
        `attachments (${missing} missing), ${orphanedAttachments.size} remain`
    );
  }

  // This call is intentionally not awaited. We block the app while running
  // all fetches above to ensure that there are no in-flight attachments that
  // are saved to disk, but not put into any message or conversation model yet.
  deleteOrphanedAttachments({
    orphanedAttachments,
    sql,
    userDataPath,
  });
}

function deleteOrphanedAttachments({
  orphanedAttachments,
  sql,
  userDataPath,
}: DeleteOrphanedAttachmentsOptionsType): void {
  // This function *can* throw.
  async function runWithPossibleException(): Promise<void> {
    let cursor: MessageAttachmentsCursorType | undefined;
    let totalFound = 0;
    let totalMissing = 0;
    try {
      do {
        let attachments: ReadonlyArray<string>;

        // eslint-disable-next-line no-await-in-loop
        ({ attachments, cursor } = await sql.sqlCall(
          'getKnownMessageAttachments',
          cursor
        ));

        totalFound += attachments.length;

        for (const known of attachments) {
          if (!orphanedAttachments.delete(known)) {
            totalMissing += 1;
          }
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
        await sql.sqlCall('finishGetKnownMessageAttachments', cursor);
      }
    }

    console.log(
      `cleanupOrphanedAttachments: found ${totalFound} message ` +
        `attachments, (${totalMissing} missing) ` +
        `${orphanedAttachments.size} remain`
    );

    await deleteAllAttachments({
      userDataPath,
      attachments: Array.from(orphanedAttachments),
    });
  }

  async function runSafe() {
    const start = Date.now();
    try {
      await runWithPossibleException();
    } catch (error) {
      console.error(
        'deleteOrphanedAttachments: error',
        Errors.toLogFormat(error)
      );
    } finally {
      const duration = Date.now() - start;
      console.log(`deleteOrphanedAttachments: took ${duration}ms`);
    }
  }

  // Intentionally not awaiting
  void runSafe();
}

let attachmentsDir: string | undefined;
let stickersDir: string | undefined;
let tempDir: string | undefined;
let draftDir: string | undefined;
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
  avatarDataDir = getAvatarsPath(configDir);

  ipcMain.handle(ERASE_TEMP_KEY, () => {
    strictAssert(tempDir != null, 'not initialized');
    rimraf.sync(tempDir);
  });
  ipcMain.handle(ERASE_ATTACHMENTS_KEY, () => {
    strictAssert(attachmentsDir != null, 'not initialized');
    rimraf.sync(attachmentsDir);
  });
  ipcMain.handle(ERASE_STICKERS_KEY, () => {
    strictAssert(stickersDir != null, 'not initialized');
    rimraf.sync(stickersDir);
  });
  ipcMain.handle(ERASE_DRAFTS_KEY, () => {
    strictAssert(draftDir != null, 'not initialized');
    rimraf.sync(draftDir);
  });

  ipcMain.handle(CLEANUP_ORPHANED_ATTACHMENTS_KEY, async () => {
    const start = Date.now();
    await cleanupOrphanedAttachments({ sql, userDataPath: configDir });
    const duration = Date.now() - start;
    console.log(`cleanupOrphanedAttachments: took ${duration}ms`);
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
    disposition = dispositionSchema.parse(dispositionParam);
  }

  strictAssert(attachmentsDir != null, 'not initialized');
  strictAssert(tempDir != null, 'not initialized');
  strictAssert(draftDir != null, 'not initialized');
  strictAssert(stickersDir != null, 'not initialized');
  strictAssert(avatarDataDir != null, 'not initialized');

  let parentDir: string;
  switch (disposition) {
    case 'attachment':
      parentDir = attachmentsDir;
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

  // Get attachment size to trim the padding
  const sizeParam = url.searchParams.get('size');
  let maybeSize: number | undefined;
  if (sizeParam != null) {
    const intValue = safeParseInteger(sizeParam);
    if (intValue != null) {
      maybeSize = intValue;
    }
  }

  // Legacy plaintext attachments
  if (url.host === 'v1') {
    return handleRangeRequest({
      request: req,
      size: maybeSize,
      plaintext: createReadStream(path),
    });
  }

  // Encrypted attachments

  // Get AES+MAC key
  const maybeKeysBase64 = url.searchParams.get('key');
  if (maybeKeysBase64 == null) {
    return new Response('Missing key', { status: 400 });
  }

  // Size is required for trimming padding
  if (maybeSize == null) {
    return new Response('Missing size', { status: 400 });
  }

  // Pacify typescript
  const size = maybeSize;
  const keysBase64 = maybeKeysBase64;

  const plaintext = new PassThrough();

  async function runSafe(): Promise<void> {
    try {
      await decryptAttachmentV2ToSink(
        {
          ciphertextPath: path,
          idForLogging: 'attachment_channel',
          keysBase64,
          type: 'local',
          size,
        },
        plaintext
      );
    } catch (error) {
      plaintext.emit('error', error);

      // These errors happen when canceling fetch from `attachment://` urls,
      // ignore them to avoid noise in the logs.
      if (error.name === 'AbortError') {
        return;
      }

      console.error(
        'handleAttachmentRequest: decryption error',
        Errors.toLogFormat(error)
      );
    }
  }

  drop(runSafe());

  return handleRangeRequest({
    request: req,
    size: maybeSize,
    plaintext,
  });
}

type HandleRangeRequestOptionsType = Readonly<{
  request: Request;
  size: number | undefined;
  plaintext: Readable;
}>;

function handleRangeRequest({
  request,
  size,
  plaintext,
}: HandleRangeRequestOptionsType): Response {
  const url = new URL(request.url);

  // Get content-type
  const contentType = url.searchParams.get('contentType');

  const headers: HeadersInit = {
    'cache-control': 'no-cache, no-store',
    'content-type': contentType || 'application/octet-stream',
  };

  if (size != null) {
    headers['content-length'] = size.toString();
  }

  const create200Response = (): Response => {
    return new Response(Readable.toWeb(plaintext) as ReadableStream<Buffer>, {
      status: 200,
      headers,
    });
  };

  const range = request.headers.get('range');
  if (range == null) {
    return create200Response();
  }

  const match = range.match(/^bytes=(\d+)-(\d+)?$/);
  if (match == null) {
    console.error(`attachment_channel: invalid range header: ${range}`);
    return create200Response();
  }

  const startParam = safeParseInteger(match[1]);
  if (startParam == null) {
    console.error(`attachment_channel: invalid range header: ${range}`);
    return create200Response();
  }

  let endParam: number | undefined;
  if (match[2] != null) {
    const intValue = safeParseInteger(match[2]);
    if (intValue == null) {
      console.error(`attachment_channel: invalid range header: ${range}`);
      return create200Response();
    }
    endParam = intValue;
  }

  const start = Math.min(startParam, size || Infinity);
  let end: number;
  if (endParam === undefined) {
    end = size || Infinity;
  } else {
    // Supplied range is inclusive
    end = Math.min(endParam + 1, size || Infinity);
  }

  let offset = 0;
  const transform = new Transform({
    transform(data, _enc, callback) {
      if (offset + data.byteLength >= start && offset <= end) {
        this.push(data.subarray(Math.max(0, start - offset), end - offset));
      }

      offset += data.byteLength;
      callback();
    },
  });

  headers['content-range'] =
    size === undefined
      ? `bytes ${start}-${endParam === undefined ? '' : end - 1}/*`
      : `bytes ${start}-${end - 1}/${size}`;

  if (endParam !== undefined || size !== undefined) {
    headers['content-length'] = (end - start).toString();
  }

  drop(
    (async () => {
      try {
        await pipeline(plaintext, transform);
      } catch (error) {
        transform.emit('error', error);

        // These errors happen when canceling fetch from `attachment://` urls,
        // ignore them to avoid noise in the logs.
        if (error.name === 'AbortError') {
          return;
        }

        console.error(
          'handleAttachmentRequest: range transform error',
          Errors.toLogFormat(error)
        );
      }
    })()
  );

  return new Response(Readable.toWeb(transform) as ReadableStream<Buffer>, {
    status: 206,
    headers,
  });
}
