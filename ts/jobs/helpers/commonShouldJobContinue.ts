// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { waitForOnline } from '../../util/waitForOnline';
import { exponentialBackoffSleepTime } from '../../util/exponentialBackoff';
import { isDone as isDeviceLinked } from '../../util/registration';
import { sleeper } from '../../util/sleeper';

export async function commonShouldJobContinue({
  attempt,
  log,
  timeRemaining,
  skipWait,
}: Readonly<{
  attempt: number;
  log: LoggerType;
  timeRemaining: number;
  skipWait: boolean;
}>): Promise<boolean> {
  if (timeRemaining <= 0) {
    log.info("giving up because it's been too long");
    return false;
  }

  try {
    await waitForOnline({ timeout: timeRemaining });
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

  if (skipWait) {
    return true;
  }

  const sleepTime = exponentialBackoffSleepTime(attempt);
  if (sleepTime > 0) {
    log.info(`sleeping for ${sleepTime}`);
    await sleeper.sleep(
      sleepTime,
      `commonShouldJobContinue: attempt ${attempt}, skipWait ${skipWait}`
    );
  }

  return true;
}
