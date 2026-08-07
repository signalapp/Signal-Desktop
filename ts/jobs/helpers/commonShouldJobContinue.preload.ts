// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isOnline } from '../../textsecure/WebAPI.preload.ts';
import { waitForOnline } from '../../util/waitForOnline.dom.ts';
import { exponentialBackoffSleepTime } from '../../util/exponentialBackoff.std.ts';
import { isDone as isDeviceLinked } from '../../util/registration.preload.ts';
import { sleeper } from '../../util/sleeper.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';

import type { LoggerType } from '../../types/Logging.std.ts';
import type { ExponentialBackoffOptionsType } from '../../util/exponentialBackoff.std.ts';

export async function commonShouldJobContinue({
  attempt,
  backoffOptions,
  log,
  skipWait,
  timeRemaining,
}: Readonly<{
  attempt: number;
  backoffOptions?: ExponentialBackoffOptionsType;
  log: LoggerType;
  skipWait: boolean;
  timeRemaining: number;
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

  const sleepTime = exponentialBackoffSleepTime(attempt, backoffOptions);
  if (sleepTime > 0) {
    log.info(`sleeping for ${sleepTime}`);
    await sleeper.sleep(
      sleepTime,
      `commonShouldJobContinue: attempt ${attempt}, skipWait ${skipWait}`
    );
  }

  return true;
}
