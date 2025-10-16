// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import { sleepForRateLimitRetryAfterTime } from './sleepForRateLimitRetryAfterTime.std.js';
import { getHttpErrorCode } from './getHttpErrorCode.std.js';

export async function handleCommonJobRequestError({
  err,
  log,
  timeRemaining,
}: Readonly<{
  err: unknown;
  log: LoggerType;
  timeRemaining: number;
}>): Promise<void> {
  switch (getHttpErrorCode(err)) {
    case 413:
    case 429:
      await sleepForRateLimitRetryAfterTime({ err, log, timeRemaining });
      return;
    case 508:
      log.info('server responded with 508. Giving up on this job');
      return;
    default:
      throw err;
  }
}
