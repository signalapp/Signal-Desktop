// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { sleepFor413RetryAfterTime } from './sleepFor413RetryAfterTime';
import { getHttpErrorCode } from './getHttpErrorCode';

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
      await sleepFor413RetryAfterTime({ err, log, timeRemaining });
      return;
    case 508:
      log.info('server responded with 508. Giving up on this job');
      return;
    default:
      throw err;
  }
}
