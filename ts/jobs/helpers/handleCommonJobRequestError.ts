// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { parseIntWithFallback } from '../../util/parseIntWithFallback';
import { HTTPError } from '../../textsecure/Errors';
import { sleepFor413RetryAfterTimeIfApplicable } from './sleepFor413RetryAfterTimeIfApplicable';

export async function handleCommonJobRequestError({
  err,
  log,
  timeRemaining,
}: Readonly<{
  err: unknown;
  log: LoggerType;
  timeRemaining: number;
}>): Promise<void> {
  if (!(err instanceof HTTPError)) {
    throw err;
  }

  const code = parseIntWithFallback(err.code, -1);
  if (code === 508) {
    log.info('server responded with 508. Giving up on this job');
    return;
  }

  await sleepFor413RetryAfterTimeIfApplicable({ err, log, timeRemaining });

  throw err;
}
