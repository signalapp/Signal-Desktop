// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { sleep } from '../../util/sleep';
import { parseRetryAfter } from '../../util/parseRetryAfter';
import { isRecord } from '../../util/isRecord';
import { HTTPError } from '../../textsecure/Errors';

export async function sleepFor413RetryAfterTimeIfApplicable({
  err,
  log,
  timeRemaining,
}: Readonly<{
  err: unknown;
  log: Pick<LoggerType, 'info'>;
  timeRemaining: number;
}>): Promise<void> {
  if (
    timeRemaining <= 0 ||
    !(err instanceof HTTPError) ||
    err.code !== 413 ||
    !isRecord(err.responseHeaders)
  ) {
    return;
  }

  const retryAfter = Math.min(
    parseRetryAfter(err.responseHeaders['retry-after']),
    timeRemaining
  );

  log.info(
    `Got a 413 response code. Sleeping for ${retryAfter} millisecond(s)`
  );

  await sleep(retryAfter);
}
