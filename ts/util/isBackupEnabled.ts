// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isTestOrMockEnvironment } from '../environment';
import { isStagingServer } from './isStagingServer';

export function isBackupFeatureEnabled(): boolean {
  if (isStagingServer() || isTestOrMockEnvironment()) {
    return true;
  }
  return Boolean(RemoteConfig.isEnabled('desktop.backup.credentialFetch'));
}

export function isBackupFeatureEnabledForRedux(
  config: RemoteConfig.ConfigMapType | undefined
): boolean {
  if (isStagingServer() || isTestOrMockEnvironment()) {
    return true;
  }
  return Boolean(config?.['desktop.backup.credentialFetch']?.enabled);
}
