// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

import type { LoggerType } from '../types/Logging.std.js';
import * as Errors from '../types/errors.std.js';
import { SECOND, MINUTE, HOUR } from '../util/durations/index.std.js';
import { sleep } from '../util/sleep.std.js';
import { isOlderThan } from '../util/timestamp.std.js';

export type CheckIntegrityResultType = Readonly<
  | {
      ok: true;
      error?: void;
    }
  | {
      ok: false;
      error: string;
    }
>;

export async function checkIntegrity(
  fileName: string,
  sha512: string
): Promise<CheckIntegrityResultType> {
  try {
    const hash = createHash('sha512');
    await pipeline(createReadStream(fileName), hash);

    const actualSHA512 = hash.digest('base64');
    if (sha512 === actualSHA512) {
      return { ok: true };
    }

    return {
      ok: false,
      error: `Integrity check failure: expected ${sha512}, got ${actualSHA512}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: Errors.toLogFormat(error),
    };
  }
}

async function doGracefulFSOperation<Args extends ReadonlyArray<unknown>>({
  name,
  operation,
  args,
  logger,
  startedAt,
  retryCount,
  retryAfter = 5 * SECOND,
  timeout = 5 * MINUTE,
}: {
  name: string;
  operation: (...args: Args) => Promise<void>;
  args: Args;
  logger: LoggerType;
  startedAt: number;
  retryCount: number;
  retryAfter?: number;
  timeout?: number;
}): Promise<void> {
  const logId = `gracefulFS(${name})`;
  try {
    await operation(...args);

    if (retryCount !== 0) {
      logger.info(
        `${logId}: succeeded after ${retryCount} retries, ${args.join(', ')}`
      );
    }
  } catch (error) {
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      throw error;
    }

    if (isOlderThan(startedAt, timeout)) {
      logger.warn(`${logId}: timed out, ${args.join(', ')}`);
      throw error;
    }

    logger.warn(
      `${logId}: got ${error.code} when running on ${args.join(', ')}; ` +
        `retrying in one second. (retryCount=${retryCount})`
    );

    await sleep(retryAfter);

    return doGracefulFSOperation({
      name,
      operation,
      args,
      logger,
      startedAt,
      retryCount: retryCount + 1,
      retryAfter,
      timeout,
    });
  }
}

export async function gracefulRename(
  logger: LoggerType,
  fromPath: string,
  toPath: string
): Promise<void> {
  return doGracefulFSOperation({
    name: 'rename',
    operation: rename,
    args: [fromPath, toPath],
    logger,
    startedAt: Date.now(),
    retryCount: 0,
  });
}

function rmRecursive(path: string): Promise<void> {
  return rm(path, { recursive: true, force: true });
}

export async function gracefulRmRecursive(
  logger: LoggerType,
  path: string
): Promise<void> {
  return doGracefulFSOperation({
    name: 'rmRecursive',
    operation: rmRecursive,
    args: [path],
    logger,
    startedAt: Date.now(),
    retryCount: 0,
  });
}

const MAX_UPDATE_DELAY = 6 * HOUR;

export function isTimeToUpdate({
  logger,
  pollId,
  releasedAt,
  now = Date.now(),
  maxDelay = MAX_UPDATE_DELAY,
}: {
  logger: LoggerType;
  pollId: string;
  releasedAt: number;
  now?: number;
  maxDelay?: number;
}): boolean {
  // Check that the release date is a proper number
  if (!Number.isFinite(releasedAt) || Number.isNaN(releasedAt)) {
    logger.warn('isTimeToUpdate: invalid releasedAt');
    return true;
  }

  // Check that the release date is not too far in the future
  if (releasedAt - HOUR > now) {
    logger.warn('isTimeToUpdate: releasedAt too far in the future');
    return true;
  }

  const digest = createHash('sha512')
    .update(pollId)
    .update(Buffer.alloc(1))
    .update(new Date(releasedAt).toJSON())
    .digest();

  const delay = maxDelay * (digest.readUInt32LE(0) / 0xffffffff);
  const updateAt = releasedAt + delay;

  if (now >= updateAt) {
    return true;
  }

  const remaining = Math.round((updateAt - now) / MINUTE);
  logger.info(`isTimeToUpdate: updating in ${remaining} minutes`);
  return false;
}
