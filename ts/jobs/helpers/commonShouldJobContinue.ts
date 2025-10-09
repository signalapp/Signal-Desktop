// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.js';
import { isOnline } from '../../textsecure/WebAPI.js';
import { waitForOnline } from '../../util/waitForOnline.js';
import { exponentialBackoffSleepTime } from '../../util/exponentialBackoff.js';
import { isDone as isDeviceLinked } from '../../util/registration.js';
import { sleeper } from '../../util/sleeper.js';
import { itemStorage } from '../../textsecure/Storage.js';

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
    if (isDeviceLinked()) {
      await waitForOnline({ server: { isOnline }, timeout: timeRemaining });
    }
  } catch (err: unknown) {
    log.info("didn't come online in time, giving up");
    return false;
  }

  await new Promise<void>(resolve => {
    itemStorage.onready(resolve);
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
