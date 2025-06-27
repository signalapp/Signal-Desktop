// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isTestOrMockEnvironment } from '../environment';
import { isStagingServer } from './isStagingServer';
import { isNightly } from './version';

export function isLocalBackupsEnabled(): boolean {
  if (isStagingServer() || isTestOrMockEnvironment()) {
    return true;
  }

  if (RemoteConfig.isEnabled('desktop.internalUser')) {
    return true;
  }

  const version = window.getVersion?.();
  if (version != null) {
    return isNightly(version);
  }

  return false;
}

export function isLocalBackupsEnabledForRedux(
  config: Pick<RemoteConfig.ConfigMapType, 'desktop.internalUser'> | undefined
): boolean {
  if (isStagingServer() || isTestOrMockEnvironment()) {
    return true;
  }

  if (config?.['desktop.internalUser']?.enabled) {
    return true;
  }

  const version = window.getVersion?.();
  if (version != null) {
    return isNightly(version);
  }

  return false;
}
