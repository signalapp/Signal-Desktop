// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { sleep } from '../../util/sleep';
import { parseRetryAfter } from '../../util/parseRetryAfter';
import { isRecord } from '../../util/isRecord';
import { HTTPError } from '../../textsecure/Errors';

export async function sleepFor413RetryAfterTime({
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

  const retryAfter = Math.min(
    parseRetryAfter(findRetryAfterTime(err)),
    timeRemaining
  );

  log.info(
    `Got a 413 response code. Sleeping for ${retryAfter} millisecond(s)`
  );

  await sleep(retryAfter);
}

function findRetryAfterTime(err: unknown): unknown {
  if (!isRecord(err)) {
    return undefined;
  }

  if (isRecord(err.responseHeaders)) {
    return err.responseHeaders['retry-after'];
  }

  if (err.httpError instanceof HTTPError) {
    return err.httpError.responseHeaders?.['retry-after'];
  }

  return undefined;
}
