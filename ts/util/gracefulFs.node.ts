// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { rename, rm } from 'node:fs/promises';

import type { LoggerType } from '../types/Logging.std.js';
import { SECOND, MINUTE } from './durations/index.std.js';
import { isOlderThan } from './timestamp.std.js';
import { sleep } from './sleep.std.js';

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
