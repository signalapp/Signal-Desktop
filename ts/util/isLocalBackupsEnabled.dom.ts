// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import { type ConfigMapType } from '../RemoteConfig.dom.ts';
import {
  isFeaturedEnabledNoRedux,
  isFeaturedEnabledSelector,
} from './isFeatureEnabled.dom.ts';

export function isLocalBackupsEnabled(reduxArgs?: {
  currentVersion: string;
  remoteConfig: ReadonlyDeep<ConfigMapType> | undefined;
}): boolean {
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
