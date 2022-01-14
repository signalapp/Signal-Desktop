// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import * as Errors from '../../types/errors';
import { sleepFor413RetryAfterTime } from './sleepFor413RetryAfterTime';
import { getHttpErrorCode } from './getHttpErrorCode';
import { strictAssert } from '../../util/assert';
import { findRetryAfterTimeFromError } from './findRetryAfterTimeFromError';

export async function handleMultipleSendErrors({
  errors,
  isFinalAttempt,
  log,
  markFailed,
  timeRemaining,
}: Readonly<{
  errors: ReadonlyArray<unknown>;
  isFinalAttempt: boolean;
  log: Pick<LoggerType, 'info'>;
  markFailed?: (() => void) | (() => Promise<void>);
  timeRemaining: number;
}>): Promise<void> {
  strictAssert(errors.length, 'Expected at least one error');

  const formattedErrors: Array<string> = [];

  let retryAfterError: unknown;
  let longestRetryAfterTime = -Infinity;

  let serverAskedUsToStop = false;

  errors.forEach(error => {
    formattedErrors.push(Errors.toLogFormat(error));

    const errorCode = getHttpErrorCode(error);
    if (errorCode === 413) {
      const retryAfterTime = findRetryAfterTimeFromError(error);
      if (retryAfterTime > longestRetryAfterTime) {
        retryAfterError = error;
        longestRetryAfterTime = retryAfterTime;
      }
    } else if (errorCode === 508) {
      serverAskedUsToStop = true;
    }
  });

  log.info(
    `${formattedErrors.length} send error(s): ${formattedErrors.join(',')}`
  );

  if (isFinalAttempt || serverAskedUsToStop) {
    await markFailed?.();
  }

  if (serverAskedUsToStop) {
    log.info('server responded with 508. Giving up on this job');
    return;
  }

  if (retryAfterError && !isFinalAttempt) {
    await sleepFor413RetryAfterTime({
      err: retryAfterError,
      log,
      timeRemaining,
    });
  }

  throw errors[0];
}
