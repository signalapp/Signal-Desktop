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
import { isNotUpdatable } from '../../util/version';

const NINETY_ONE_DAYS = 91 * DAY;
const THIRTY_ONE_DAYS = 31 * DAY;
const SIXTY_DAYS = 60 * DAY;

export const getExpiration = (state: StateType): ExpirationStateType =>
  state.expiration;

const getPackagedBuildExpiration = createSelector(
  getExpiration,
  ({ buildExpiration }) => buildExpiration
);

export const getExpirationTimestamp = createSelector(
  getPackagedBuildExpiration,
  getRemoteBuildExpiration,
  getAutoDownloadUpdate,
  (
    buildExpiration: number,
    remoteBuildExpiration: number | undefined,
    autoDownloadUpdate: boolean
  ): number => {
    const localBuildExpiration =
      isNotUpdatable(window.getVersion()) || autoDownloadUpdate
        ? buildExpiration
        : buildExpiration - SIXTY_DAYS;

    // Log the expiration date in this selector because it invalidates only
    // if one of the arguments changes.
    let result: number;
    let type: string;
    if (remoteBuildExpiration && remoteBuildExpiration < localBuildExpiration) {
      type = 'remote';
      result = remoteBuildExpiration;
    } else {
      type = 'local';
      result = localBuildExpiration;
    }
    log.info(`Build expires (${type}): ${new Date(result).toISOString()}`);
    return result;
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
    if (getEnvironment() !== Environment.PackagedApp && buildExpiration === 0) {
      return false;
    }

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
