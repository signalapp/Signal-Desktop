// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { strictAssert } from './assert.std.js';
import { safeParseInteger } from './numbers.std.js';
import { DataReader } from '../sql/Client.preload.js';
import { createLogger } from '../logging/log.std.js';

const { debounce, isNumber } = lodash;

const log = createLogger('incrementMessageCounter');

let receivedAtCounter: number | undefined;

export async function initializeMessageCounter(): Promise<void> {
  strictAssert(
    receivedAtCounter === undefined,
    'incrementMessageCounter: already initialized'
  );

  const storedCounter = safeParseInteger(
    localStorage.getItem('lastReceivedAtCounter') ?? ''
  );
  const dbCounter = await DataReader.getMaxMessageCounter();

  if (isNumber(dbCounter) && isNumber(storedCounter)) {
    log.info('initializeMessageCounter: picking max of db/stored counters');
    receivedAtCounter = Math.max(dbCounter, storedCounter);

    if (receivedAtCounter !== storedCounter) {
      log.warn('initializeMessageCounter: mismatch between db/stored counters');
    }
  } else if (isNumber(storedCounter)) {
    log.info('initializeMessageCounter: picking stored counter');
    receivedAtCounter = storedCounter;
  } else if (isNumber(dbCounter)) {
    log.info(
      'initializeMessageCounter: picking fallback counter from the database'
    );
    receivedAtCounter = dbCounter;
  } else {
    log.info('initializeMessageCounter: defaulting to Date.now()');
    receivedAtCounter = Date.now();
  }

  if (storedCounter !== receivedAtCounter) {
    localStorage.setItem('lastReceivedAtCounter', String(receivedAtCounter));
  }
}

export function incrementMessageCounter(): number {
  strictAssert(
    receivedAtCounter !== undefined,
    'incrementMessageCounter: not initialized'
  );

  receivedAtCounter += 1;
  debouncedUpdateLastReceivedAt();

  return receivedAtCounter;
}

export function flushMessageCounter(): void {
  debouncedUpdateLastReceivedAt.flush();
}

const debouncedUpdateLastReceivedAt = debounce(
  () => {
    localStorage.setItem('lastReceivedAtCounter', String(receivedAtCounter));
  },
  25,
  {
    maxWait: 25,
  }
);
