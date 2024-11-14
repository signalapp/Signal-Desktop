// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { rename, rm } from 'fs/promises';
import { pipeline } from 'stream/promises';

import type { LoggerType } from '../types/Logging';
import * as Errors from '../types/errors';
import * as durations from '../util/durations';
import { sleep } from '../util/sleep';
import { isOlderThan } from '../util/timestamp';

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
  retryAfter = 5 * durations.SECOND,
  timeout = 5 * durations.MINUTE,
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
