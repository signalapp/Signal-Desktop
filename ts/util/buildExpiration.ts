// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Environment, getEnvironment } from '../environment.std.js';
import type { LoggerType } from '../types/Logging.std.js';
import { isNotUpdatable } from './version.std.js';
import { isInPast } from './timestamp.std.js';
import { DAY } from './durations/index.std.js';

const NINETY_ONE_DAYS = 91 * DAY;
const THIRTY_ONE_DAYS = 31 * DAY;
const SIXTY_DAYS = 60 * DAY;

export type GetBuildExpirationTimestampOptionsType = Readonly<{
  version: string;
  packagedBuildExpiration: number;
  remoteBuildExpiration: number | undefined;
  autoDownloadUpdate: boolean;
  logger: LoggerType;
}>;

export function getBuildExpirationTimestamp({
  version,
  packagedBuildExpiration,
  remoteBuildExpiration,
  autoDownloadUpdate,
  logger,
}: GetBuildExpirationTimestampOptionsType): number {
  const localBuildExpiration =
    isNotUpdatable(version) || autoDownloadUpdate
      ? packagedBuildExpiration
      : packagedBuildExpiration - SIXTY_DAYS;

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
  logger.info(`Build expires (${type}): ${new Date(result).toISOString()}`);
  return result;
}

export type HasBuildExpiredOptionsType = Readonly<{
  buildExpirationTimestamp: number;
  autoDownloadUpdate: boolean;
  now: number;
  logger: LoggerType;
}>;

export function hasBuildExpired({
  buildExpirationTimestamp,
  autoDownloadUpdate,
  now,
  logger,
}: HasBuildExpiredOptionsType): boolean {
  if (
    getEnvironment() !== Environment.PackagedApp &&
    buildExpirationTimestamp === 0
  ) {
    return false;
  }

  if (isInPast(buildExpirationTimestamp)) {
    return true;
  }

  const safeExpirationMs = autoDownloadUpdate
    ? NINETY_ONE_DAYS
    : THIRTY_ONE_DAYS;

  const buildExpirationDuration = buildExpirationTimestamp - now;
  const tooFarIntoFuture = buildExpirationDuration > safeExpirationMs;

  if (tooFarIntoFuture) {
    logger.error(
      'Build expiration is set too far into the future',
      buildExpirationTimestamp
    );
  }

  return tooFarIntoFuture || isInPast(buildExpirationTimestamp);
}
