// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { Environment, getEnvironment } from '../../environment';
import { isInPast } from '../../util/timestamp';
import { DAY } from '../../util/durations';
import * as log from '../../logging/log';
import type { StateType } from '../reducer';
import type { ExpirationStateType } from '../ducks/expiration';
import { getRemoteBuildExpiration, getAutoDownloadUpdate } from './items';

const NINETY_ONE_DAYS = 91 * DAY;
const THIRTY_ONE_DAYS = 31 * DAY;
const SIXTY_DAYS = 60 * DAY;

export const getExpiration = (state: StateType): ExpirationStateType =>
  state.expiration;

export const getExpirationTimestamp = createSelector(
  getExpiration,
  getRemoteBuildExpiration,
  getAutoDownloadUpdate,
  (
    { buildExpiration }: Readonly<ExpirationStateType>,
    remoteBuildExpiration: number | undefined,
    autoDownloadUpdate: boolean
  ): number => {
    const localBuildExpiration = autoDownloadUpdate
      ? buildExpiration
      : buildExpiration - SIXTY_DAYS;

    if (remoteBuildExpiration) {
      return Math.min(remoteBuildExpiration, localBuildExpiration);
    }

    return localBuildExpiration;
  }
);

export type HasExpiredOptionsType = Readonly<{
  now?: number;
}>;

export const hasExpired = createSelector(
  getExpirationTimestamp,
  getAutoDownloadUpdate,
  (_: StateType, { now = Date.now() }: HasExpiredOptionsType = {}) => now,
  (buildExpiration: number, autoDownloadUpdate: boolean, now: number) => {
    if (getEnvironment() !== Environment.Production && buildExpiration === 0) {
      return false;
    }

    log.info('Build expires: ', new Date(buildExpiration).toISOString());

    if (isInPast(buildExpiration)) {
      return true;
    }

    const safeExpirationMs = autoDownloadUpdate
      ? NINETY_ONE_DAYS
      : THIRTY_ONE_DAYS;

    const buildExpirationDuration = buildExpiration - now;
    const tooFarIntoFuture = buildExpirationDuration > safeExpirationMs;

    if (tooFarIntoFuture) {
      log.error(
        'Build expiration is set too far into the future',
        buildExpiration
      );
    }

    return tooFarIntoFuture || isInPast(buildExpiration);
  }
);
