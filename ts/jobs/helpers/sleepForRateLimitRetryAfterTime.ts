// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { sleep } from '../../util/sleep';
import { findRetryAfterTimeFromError } from './findRetryAfterTimeFromError';

export async function sleepForRateLimitRetryAfterTime({
  err,
  log,
  timeRemaining,
}: Readonly<{
  err: unknown;
  log: Pick<LoggerType, 'info'>;
  timeRemaining: number;
}>): Promise<void> {
  if (timeRemaining <= 0) {
    return;
  }

  const retryAfter = Math.min(findRetryAfterTimeFromError(err), timeRemaining);

  log.info(
    `Got a 413 or 429 response code. Sleeping for ${retryAfter} millisecond(s)`
  );

  await sleep(retryAfter);
}
