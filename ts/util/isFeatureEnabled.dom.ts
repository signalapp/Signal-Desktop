// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';

import type { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep.js';

import { createLogger } from '../logging/log.std.js';
import { isTestOrMockEnvironment } from '../environment.std.js';
import { getValue, isEnabled } from '../RemoteConfig.dom.js';
import { isAlpha, isBeta, isProduction, isStaging } from './version.std.js';

import type { SemverKeyType, ConfigMapType } from '../RemoteConfig.dom.js';

const log = createLogger('isFeatureEnabled');

export function isFeaturedEnabledSelector({
  betaKey,
  currentVersion,
  prodKey,
  remoteConfig,
}: {
  betaKey: SemverKeyType;
  currentVersion: string;
  prodKey: SemverKeyType;
  remoteConfig: ReadonlyObjectDeep<ConfigMapType> | undefined;
}): boolean {
  return _isFeatureEnabledInner({
    betaValue: remoteConfig?.[betaKey]?.value,
    currentVersion,
    isInternalUser: remoteConfig?.['desktop.internalUser']?.enabled ?? false,
    prodValue: remoteConfig?.[prodKey]?.value,
  });
}

export function isFeaturedEnabledNoRedux({
  betaKey,
  prodKey,
}: {
  betaKey: SemverKeyType;
  prodKey: SemverKeyType;
}): boolean {
  return _isFeatureEnabledInner({
    betaValue: getValue(betaKey),
    currentVersion: window.getVersion(),
    isInternalUser: isEnabled('desktop.internalUser'),
    prodValue: getValue(prodKey),
  });
}

// Exported for testing
export function _isFeatureEnabledInner({
  betaValue,
  currentVersion,
  isInternalUser,
  prodValue,
  isTestEnvironment = isTestOrMockEnvironment,
}: {
  betaValue: string | undefined;
  currentVersion: string;
  isInternalUser: boolean;
  prodValue: string | undefined;
  isTestEnvironment?: () => boolean;
}): boolean {
  if (
    isInternalUser ||
    isAlpha(currentVersion) ||
    isStaging(currentVersion) ||
    isTestEnvironment()
  ) {
    return true;
  }

  if (!semver.parse(currentVersion)) {
    log.error(`currentVersion ${currentVersion} was invalid`);
    return false;
  }

  if (
    isBeta(currentVersion) &&
    betaValue &&
    semver.parse(betaValue) &&
    semver.gte(currentVersion, betaValue)
  ) {
    return true;
  }

  if (
    isProduction(currentVersion) &&
    prodValue &&
    semver.parse(prodValue) &&
    semver.gte(currentVersion, prodValue)
  ) {
    return true;
  }

  return false;
}
