// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { last, sortBy } from 'lodash';
import { AuthCredentialResponse } from '@signalapp/libsignal-client/zkgroup';

import { getClientZkAuthOperations } from '../util/zkgroup';

import type { GroupCredentialType } from '../textsecure/WebAPI';
import * as durations from '../util/durations';
import { BackOff } from '../util/BackOff';
import { sleep } from '../util/sleep';
import { UUIDKind } from '../types/UUID';
import * as log from '../logging/log';

export const GROUP_CREDENTIALS_KEY = 'groupCredentials';

type CredentialsDataType = Array<GroupCredentialType>;
type RequestDatesType = {
  startDay: number;
  endDay: number;
};
type NextCredentialsType = {
  today: GroupCredentialType;
  tomorrow: GroupCredentialType;
};

function getTodayInEpoch() {
  return Math.floor(Date.now() / durations.DAY);
}

let started = false;

export async function initializeGroupCredentialFetcher(): Promise<void> {
  if (started) {
    return;
  }

  log.info('initializeGroupCredentialFetcher: starting...');
  started = true;

  // Because we fetch eight days of credentials at a time, we really only need to run
  //   this about once a week. But there's no problem running it more often; it will do
  //   nothing if no new credentials are needed, and will only request needed credentials.
  await runWithRetry(maybeFetchNewCredentials, {
    scheduleAnother: 4 * durations.HOUR,
  });
}

const BACKOFF_TIMEOUTS = [
  durations.SECOND,
  5 * durations.SECOND,
  30 * durations.SECOND,
  2 * durations.MINUTE,
  5 * durations.MINUTE,
];

export async function runWithRetry(
  fn: () => Promise<void>,
  options: { scheduleAnother?: number } = {}
): Promise<void> {
  const backOff = new BackOff(BACKOFF_TIMEOUTS);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await fn();
      return;
    } catch (error) {
      const wait = backOff.getAndIncrement();
      log.info(
        `runWithRetry: ${fn.name} failed. Waiting ${wait}ms for retry. Error: ${error.stack}`
      );
      // eslint-disable-next-line no-await-in-loop
      await sleep(wait);
    }
  }

  // It's important to schedule our next run here instead of the level above; otherwise we
  //   could end up with multiple endlessly-retrying runs.
  const duration = options.scheduleAnother;
  if (duration) {
    log.info(
      `runWithRetry: scheduling another run with a setTimeout duration of ${duration}ms`
    );
    setTimeout(async () => runWithRetry(fn, options), duration);
  }
}

// In cases where we are at a day boundary, we might need to use tomorrow in a retry
export function getCredentialsForToday(
  data: CredentialsDataType | undefined
): NextCredentialsType {
  if (!data) {
    throw new Error('getCredentialsForToday: No credentials fetched!');
  }

  const todayInEpoch = getTodayInEpoch();
  const todayIndex = data.findIndex(
    (item: GroupCredentialType) => item.redemptionTime === todayInEpoch
  );
  if (todayIndex < 0) {
    throw new Error(
      'getCredentialsForToday: Cannot find credentials for today'
    );
  }

  return {
    today: data[todayIndex],
    tomorrow: data[todayIndex + 1],
  };
}

export async function maybeFetchNewCredentials(): Promise<void> {
  const uuid = window.textsecure.storage.user.getUuid()?.toString();
  if (!uuid) {
    log.info('maybeFetchCredentials: no UUID, returning early');
    return;
  }
  const previous: CredentialsDataType | undefined = window.storage.get(
    GROUP_CREDENTIALS_KEY
  );
  const requestDates = getDatesForRequest(previous);
  if (!requestDates) {
    log.info('maybeFetchCredentials: no new credentials needed');
    return;
  }

  const accountManager = window.getAccountManager();
  if (!accountManager) {
    log.info('maybeFetchCredentials: unable to get AccountManager');
    return;
  }

  const { startDay, endDay } = requestDates;
  log.info(
    `maybeFetchCredentials: fetching credentials for ${startDay} through ${endDay}`
  );

  const serverPublicParamsBase64 = window.getServerPublicParams();
  const clientZKAuthOperations = getClientZkAuthOperations(
    serverPublicParamsBase64
  );
  const newCredentials = sortCredentials(
    await accountManager.getGroupCredentials(startDay, endDay, UUIDKind.ACI)
  ).map((item: GroupCredentialType) => {
    const authCredential = clientZKAuthOperations.receiveAuthCredential(
      uuid,
      item.redemptionTime,
      new AuthCredentialResponse(Buffer.from(item.credential, 'base64'))
    );
    const credential = authCredential.serialize().toString('base64');

    return {
      redemptionTime: item.redemptionTime,
      credential,
    };
  });

  const todayInEpoch = getTodayInEpoch();
  const previousCleaned = previous
    ? previous.filter(
        (item: GroupCredentialType) => item.redemptionTime >= todayInEpoch
      )
    : [];
  const finalCredentials = [...previousCleaned, ...newCredentials];

  log.info('maybeFetchCredentials: Saving new credentials...');
  // Note: we don't wait for this to finish
  window.storage.put(GROUP_CREDENTIALS_KEY, finalCredentials);
  log.info('maybeFetchCredentials: Save complete.');
}

export function getDatesForRequest(
  data?: CredentialsDataType
): RequestDatesType | undefined {
  const todayInEpoch = getTodayInEpoch();
  const oneWeekOut = todayInEpoch + 7;

  const lastCredential = last(data);
  if (!lastCredential || lastCredential.redemptionTime < todayInEpoch) {
    return {
      startDay: todayInEpoch,
      endDay: oneWeekOut,
    };
  }

  if (lastCredential.redemptionTime >= oneWeekOut) {
    return undefined;
  }

  return {
    startDay: lastCredential.redemptionTime + 1,
    endDay: oneWeekOut,
  };
}

export function sortCredentials(
  data: CredentialsDataType
): CredentialsDataType {
  return sortBy(data, (item: GroupCredentialType) => item.redemptionTime);
}
