// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { createLogger } from '../../logging/log';
import type { StateType } from '../reducer';
import type { ExpirationStateType } from '../ducks/expiration';
import { getRemoteBuildExpiration, getAutoDownloadUpdate } from './items';
import {
  getBuildExpirationTimestamp,
  hasBuildExpired,
} from '../../util/buildExpiration';

const log = createLogger('expiration');

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
    packagedBuildExpiration: number,
    remoteBuildExpiration: number | undefined,
    autoDownloadUpdate: boolean
  ): number => {
    return getBuildExpirationTimestamp({
      version: window.getVersion(),
      packagedBuildExpiration,
      remoteBuildExpiration,
      autoDownloadUpdate,
      logger: log,
    });
  }
);

export type HasExpiredOptionsType = Readonly<{
  now?: number;
}>;

export const hasExpired = createSelector(
  getExpirationTimestamp,
  getAutoDownloadUpdate,
  (_: StateType, { now = Date.now() }: HasExpiredOptionsType = {}) => now,
  (
    buildExpirationTimestamp: number,
    autoDownloadUpdate: boolean,
    now: number
  ) => {
    return hasBuildExpired({
      buildExpirationTimestamp,
      autoDownloadUpdate,
      now,
      logger: log,
    });
  }
);
