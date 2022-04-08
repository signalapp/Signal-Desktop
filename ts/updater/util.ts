// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createReadStream } from 'fs';
import { rename } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';

import * as Errors from '../types/errors';
import type { LoggerType } from '../types/Logging';
import * as durations from '../util/durations';
import { isOlderThan } from '../util/timestamp';
import { sleep } from '../util/sleep';

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

async function doGracefulRename({
  logger,
  fromPath,
  toPath,
  startedAt,
  retryCount,
  retryAfter = 5 * durations.SECOND,
  timeout = 5 * durations.MINUTE,
}: {
  logger: LoggerType;
  fromPath: string;
  toPath: string;
  startedAt: number;
  retryCount: number;
  retryAfter?: number;
  timeout?: number;
}): Promise<void> {
  try {
    await rename(fromPath, toPath);

    if (retryCount !== 0) {
      logger.info(
        `gracefulRename: succeeded after ${retryCount} retries, renamed ` +
          `${fromPath} to ${toPath}`
      );
    }
  } catch (error) {
    if (error.code !== 'EACCESS' && error.code !== 'EPERM') {
      throw error;
    }

    if (isOlderThan(startedAt, timeout)) {
      logger.warn(
        'gracefulRename: timed out while retrying renaming ' +
          `${fromPath} to ${toPath}`
      );
      throw error;
    }

    logger.warn(
      `gracefulRename: got ${error.code} when renaming ` +
        `${fromPath} to ${toPath}, retrying in one second. ` +
        `(retryCount=${retryCount})`
    );

    await sleep(retryAfter);

    return doGracefulRename({
      logger,
      fromPath,
      toPath,
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
  return doGracefulRename({
    logger,
    fromPath,
    toPath,
    startedAt: Date.now(),
    retryCount: 0,
  });
}
