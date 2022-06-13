// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Environment, getEnvironment } from '../environment';
import { isInPast } from './timestamp';
import * as log from '../logging/log';

const ONE_DAY_MS = 86400 * 1000;
const NINETY_ONE_DAYS = 91 * ONE_DAY_MS;
const THIRTY_ONE_DAYS = 31 * ONE_DAY_MS;

export function hasExpired(): boolean {
  let buildExpiration = 0;

  try {
    buildExpiration = window.getExpiration();
    if (buildExpiration) {
      log.info('Build expires: ', new Date(buildExpiration).toISOString());
    }
  } catch (e) {
    log.error('Error retrieving build expiration date', e.stack);

    return true;
  }

  if (getEnvironment() === Environment.Production) {
    const safeExpirationMs = window.Events.getAutoDownloadUpdate()
      ? NINETY_ONE_DAYS
      : THIRTY_ONE_DAYS;

    const buildExpirationDuration = buildExpiration - Date.now();
    const tooFarIntoFuture = buildExpirationDuration > safeExpirationMs;

    if (tooFarIntoFuture) {
      log.error(
        'Build expiration is set too far into the future',
        buildExpiration
      );
    }

    return tooFarIntoFuture || isInPast(buildExpiration);
  }

  return buildExpiration !== 0 && isInPast(buildExpiration);
}
