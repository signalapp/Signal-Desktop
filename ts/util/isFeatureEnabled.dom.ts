// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import { getValue, isEnabled } from '../RemoteConfig.dom.ts';
import { _isFeatureEnabledInner } from './isFeatureEnabledInner.std.ts';

import type { SemverKeyType, ConfigMapType } from '../RemoteConfig.dom.ts';

export function isFeaturedEnabledSelector({
  betaKey,
  currentVersion,
  prodKey,
  remoteConfig,
}: {
  betaKey: SemverKeyType;
  currentVersion: string;
  prodKey: SemverKeyType;
  remoteConfig: ReadonlyDeep<ConfigMapType> | undefined;
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
export { _isFeatureEnabledInner };
