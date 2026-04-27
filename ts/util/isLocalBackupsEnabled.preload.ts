// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import { isEnabled, type ConfigMapType } from '../RemoteConfig.dom.ts';
import {
  isFeaturedEnabledNoRedux,
  isFeaturedEnabledSelector,
} from './isFeatureEnabled.dom.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { isNightly } from './version.std.ts';
import { isTestOrMockEnvironment } from '../environment.std.ts';

const IOS_USER_AGENT = 'OWI';

export function isLocalBackupsEnabled(reduxArgs?: {
  currentVersion: string;
  remoteConfig: ReadonlyDeep<ConfigMapType> | undefined;
}): boolean {
  // This is a temporary guard until iOS supports importing local backups
  // Android no longer sends its OWA agent string, so we have to rely on iOS
  if (
    itemStorage.get('userAgent') === IOS_USER_AGENT &&
    !isNightly(window.getVersion()) &&
    !isTestOrMockEnvironment() &&
    !isEnabled('desktop.internalUser', reduxArgs?.remoteConfig)
  ) {
    return false;
  }

  if (reduxArgs) {
    return isFeaturedEnabledSelector({
      currentVersion: reduxArgs.currentVersion,
      remoteConfig: reduxArgs.remoteConfig,
      betaKey: 'desktop.localBackups.beta',
      prodKey: 'desktop.localBackups.prod',
    });
  }

  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.localBackups.beta',
    prodKey: 'desktop.localBackups.prod',
  });
}
