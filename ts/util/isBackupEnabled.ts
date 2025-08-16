// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig';
import { isTestOrMockEnvironment } from '../environment';
import { isStagingServer } from './isStagingServer';
import { isNightly } from './version';

export function areRemoteBackupsTurnedOn(): boolean {
  return isBackupFeatureEnabled() && window.storage.get('backupTier') != null;
}

// Downloading from a remote backup is currently a test-only feature
export function canAttemptRemoteBackupDownload(): boolean {
  return isBackupFeatureEnabled() && isTestOrMockEnvironment();
}

export function isBackupFeatureEnabled(
  reduxConfig?: RemoteConfig.ConfigMapType
): boolean {
  if (isStagingServer() || isTestOrMockEnvironment()) {
    return true;
  }

  if (isNightly(window.getVersion())) {
    return true;
  }

  return Boolean(
    RemoteConfig.isEnabled('desktop.backup.credentialFetch', reduxConfig)
  );
}
