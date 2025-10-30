// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import type { LoggerType } from '../types/Logging.std.js';
import * as Errors from '../types/errors.std.js';
import { MINUTE, HOUR } from '../util/durations/index.std.js';

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
