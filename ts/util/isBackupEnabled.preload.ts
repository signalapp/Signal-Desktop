// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../RemoteConfig.dom.js';
import { isTestOrMockEnvironment } from '../environment.std.js';
import { isStagingServer } from './isStagingServer.dom.js';
import { isBeta, isNightly } from './version.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export function areRemoteBackupsTurnedOn(): boolean {
  return isBackupFeatureEnabled() && itemStorage.get('backupTier') != null;
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

  if (isBeta(window.getVersion())) {
    return RemoteConfig.isEnabled('desktop.backups.beta', reduxConfig);
  }

  return Boolean(RemoteConfig.isEnabled('desktop.backups.prod', reduxConfig));
}
