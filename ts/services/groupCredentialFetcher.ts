// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { first, last, sortBy } from 'lodash';
import {
  AuthCredentialWithPniResponse,
  CallLinkAuthCredentialResponse,
  GenericServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup';

import { getClientZkAuthOperations } from '../util/zkgroup';

import type { GroupCredentialType } from '../textsecure/WebAPI';
import { strictAssert } from '../util/assert';
import * as durations from '../util/durations';
import { BackOff } from '../util/BackOff';
import { sleep } from '../util/sleep';
import { toDayMillis } from '../util/timestamp';
import { toTaggedPni } from '../types/ServiceId';
import { toPniObject, toAciObject } from '../util/ServiceId';
import * as log from '../logging/log';

export const GROUP_CREDENTIALS_KEY = 'groupCredentials';

type CredentialsDataType = ReadonlyArray<GroupCredentialType>;
type RequestDatesType = {
  startDayInMs: number;
  endDayInMs: number;
};
export type NextCredentialsType = {
  today: GroupCredentialType;
  tomorrow: GroupCredentialType;
};

let started = false;

function getCheckedGroupCredentials(reason: string): CredentialsDataType {
  const result = window.storage.get('groupCredentials');
  strictAssert(
    result !== undefined,
    `getCheckedCredentials: no credentials found, ${reason}`
  );
  return result;
}

function getCheckedCallLinkAuthCredentials(
  reason: string
): CredentialsDataType {
  const result = window.storage.get('callLinkAuthCredentials');
  strictAssert(
    result !== undefined,
    `getCheckedCallLinkAuthCredentials: no credentials found, ${reason}`
  );
  return result;
}

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
  // eslint-disable-next-line no-unreachable -- Why is this here, its unreachable
  const duration = options.scheduleAnother;
  if (duration) {
    log.info(
      `runWithRetry: scheduling another run with a setTimeout duration of ${duration}ms`
    );
    setTimeout(async () => runWithRetry(fn, options), duration);
  }
}

function getCredentialsForToday(
  credentials: CredentialsDataType
): NextCredentialsType {
  const today = toDayMillis(Date.now());
  const todayIndex = credentials.findIndex(
    (item: GroupCredentialType) => item.redemptionTime === today
  );
  if (todayIndex < 0) {
    throw new Error(
      'getCredentialsForToday: Cannot find credentials for today. ' +
        `First: ${first(credentials)?.redemptionTime}, ` +
        `last: ${last(credentials)?.redemptionTime}`
    );
  }

  return {
    today: credentials[todayIndex],
    tomorrow: credentials[todayIndex + 1],
  };
}

// In cases where we are at a day boundary, we might need to use tomorrow in a retry
export function getCheckedGroupCredentialsForToday(
  reason: string
): NextCredentialsType {
  return getCredentialsForToday(getCheckedGroupCredentials(reason));
}

export function getCheckedCallLinkAuthCredentialsForToday(
  reason: string
): NextCredentialsType {
  return getCredentialsForToday(getCheckedCallLinkAuthCredentials(reason));
}

export async function maybeFetchNewCredentials(): Promise<void> {
  const logId = 'maybeFetchNewCredentials';

  const maybeAci = window.textsecure.storage.user.getAci();
  if (!maybeAci) {
    log.info(`${logId}: no ACI, returning early`);
    return;
  }
  const aci = maybeAci;

  const prevGroupCredentials: CredentialsDataType =
    window.storage.get('groupCredentials') ?? [];
  const prevCallLinkAuthCredentials: CredentialsDataType =
    window.storage.get('callLinkAuthCredentials') ?? [];

  const requestDates = getDatesForRequest(prevGroupCredentials);
  const requestDatesCallLinks = getDatesForRequest(prevCallLinkAuthCredentials);

  const { server } = window.textsecure;
  if (!server) {
    log.error(`${logId}: unable to get server`);
    return;
  }

  let startDayInMs: number;
  let endDayInMs: number;
  if (requestDates) {
    startDayInMs = requestDates.startDayInMs;
    endDayInMs = requestDates.endDayInMs;
    if (requestDatesCallLinks) {
      startDayInMs = Math.min(startDayInMs, requestDatesCallLinks.startDayInMs);
      endDayInMs = Math.max(endDayInMs, requestDatesCallLinks.endDayInMs);
    }
  } else if (requestDatesCallLinks) {
    startDayInMs = requestDatesCallLinks.startDayInMs;
    endDayInMs = requestDatesCallLinks.endDayInMs;
  } else {
    log.info(`${logId}: no new credentials needed`);
    return;
  }
  log.info(
    `${logId}: fetching credentials for ${startDayInMs} through ${endDayInMs}`
  );

  const serverPublicParamsBase64 = window.getServerPublicParams();
  const clientZKAuthOperations = getClientZkAuthOperations(
    serverPublicParamsBase64
  );

  // Received credentials depend on us knowing up-to-date PNI. Use the latest
  //   value from the server and log error on mismatch.
  const {
    pni: untaggedPni,
    credentials: rawCredentials,
    callLinkAuthCredentials,
  } = await server.getGroupCredentials({ startDayInMs, endDayInMs });
  strictAssert(
    untaggedPni,
    'Server must give pni along with group credentials'
  );
  const pni = toTaggedPni(untaggedPni);

  const localPni = window.storage.user.getPni();
  if (pni !== localPni) {
    log.error(`${logId}: local PNI ${localPni}, does not match remote ${pni}`);
  }

  function formatCredential(item: GroupCredentialType): GroupCredentialType {
    const authCredential =
      clientZKAuthOperations.receiveAuthCredentialWithPniAsServiceId(
        toAciObject(aci),
        toPniObject(pni),
        item.redemptionTime,
        new AuthCredentialWithPniResponse(
          Buffer.from(item.credential, 'base64')
        )
      );
    const credential = authCredential.serialize().toString('base64');

    return {
      redemptionTime: item.redemptionTime * durations.SECOND,
      credential,
    };
  }

  const newGroupCredentials =
    sortCredentials(rawCredentials).map(formatCredential);
  const genericServerPublicParamsBase64 = window.getGenericServerPublicParams();
  const genericServerPublicParams = new GenericServerPublicParams(
    Buffer.from(genericServerPublicParamsBase64, 'base64')
  );

  function formatCallingCredential(
    item: GroupCredentialType
  ): GroupCredentialType {
    const response = new CallLinkAuthCredentialResponse(
      Buffer.from(item.credential, 'base64')
    );
    const authCredential = response.receive(
      toAciObject(aci),
      item.redemptionTime,
      genericServerPublicParams
    );
    const credential = authCredential.serialize().toString('base64');

    return {
      redemptionTime: item.redemptionTime * durations.SECOND,
      credential,
    };
  }

  const newCallLinkAuthCredentialsRaw = sortCredentials(
    callLinkAuthCredentials
  );
  const newCallLinkAuthCredentials = newCallLinkAuthCredentialsRaw.map(
    formatCallingCredential
  );

  const today = toDayMillis(Date.now());
  const prevGroupCredentialsCleaned =
    prevGroupCredentials?.filter(
      (item: GroupCredentialType) => item.redemptionTime >= today
    ) ?? [];
  const prevCallLinkAuthCredentialsCleaned =
    prevCallLinkAuthCredentials?.filter(
      (item: GroupCredentialType) => item.redemptionTime >= today
    ) ?? [];
  const finalGroupCredentials = [
    ...prevGroupCredentialsCleaned,
    ...newGroupCredentials,
  ];
  const finalCallLinkAuthCredentials = [
    ...prevCallLinkAuthCredentialsCleaned,
    ...newCallLinkAuthCredentials,
  ];

  log.info(
    `${logId}: saving ${
      finalGroupCredentials.length
    } new group credentials, cleaning up ${
      prevGroupCredentials.length - prevGroupCredentialsCleaned.length
    } old group credentials, haveToday=${haveToday(finalGroupCredentials)}`
  );
  log.info(
    `${logId}: saving ${
      finalCallLinkAuthCredentials.length
    } new call link auth credentials, cleaning up ${
      prevCallLinkAuthCredentials.length -
      prevCallLinkAuthCredentialsCleaned.length
    } old call link auth credentials, haveToday=${haveToday(
      finalCallLinkAuthCredentials
    )}`
  );

  await window.storage.put('groupCredentials', finalGroupCredentials);
  await window.storage.put(
    'callLinkAuthCredentials',
    finalCallLinkAuthCredentials
  );
  log.info(`${logId}: Save complete.`);
}

function haveToday(
  data: CredentialsDataType,
  today = toDayMillis(Date.now())
): boolean {
  return data?.some(({ redemptionTime }) => redemptionTime === today);
}

export function getDatesForRequest(
  data: CredentialsDataType
): RequestDatesType | undefined {
  const today = toDayMillis(Date.now());
  const sixDaysOut = today + 6 * durations.DAY;

  const lastCredential = last(data);
  if (
    !haveToday(data, today) ||
    !lastCredential ||
    lastCredential.redemptionTime < today
  ) {
    return {
      startDayInMs: today,
      endDayInMs: sixDaysOut,
    };
  }

  if (lastCredential.redemptionTime >= sixDaysOut) {
    return undefined;
  }

  return {
    startDayInMs: lastCredential.redemptionTime + durations.DAY,
    endDayInMs: sixDaysOut,
  };
}

export function sortCredentials(
  data: CredentialsDataType
): CredentialsDataType {
  return sortBy(data, (item: GroupCredentialType) => item.redemptionTime);
}
