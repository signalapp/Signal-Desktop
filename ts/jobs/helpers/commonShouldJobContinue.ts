// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../logging/log';
import { waitForOnline } from '../../util/waitForOnline';
import { sleep } from '../../util/sleep';
import { exponentialBackoffSleepTime } from '../../util/exponentialBackoff';
import { isDone as isDeviceLinked } from '../../util/registration';

export async function commonShouldJobContinue({
  attempt,
  log,
  maxRetryTime,
  timestamp,
}: Readonly<{
  attempt: number;
  log: LoggerType;
  maxRetryTime: number;
  timestamp: number;
}>): Promise<boolean> {
  const maxJobAge = timestamp + maxRetryTime;
  const timeRemaining = maxJobAge - Date.now();

  if (timeRemaining <= 0) {
    log.info("giving up because it's been too long");
    return false;
  }

  try {
    await waitForOnline(window.navigator, window, { timeout: timeRemaining });
  } catch (err: unknown) {
    log.info("didn't come online in time, giving up");
    return false;
  }

  await new Promise<void>(resolve => {
    window.storage.onready(resolve);
  });

  if (!isDeviceLinked()) {
    log.info("skipping this job because we're unlinked");
    return false;
  }

  const sleepTime = exponentialBackoffSleepTime(attempt);
  log.info(`sleeping for ${sleepTime}`);
  await sleep(sleepTime);

  return true;
}
